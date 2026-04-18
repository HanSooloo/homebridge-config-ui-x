import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { TestingModule } from '@nestjs/testing'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import { ValidationPipe } from '@nestjs/common'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { copy, writeJSON } from 'fs-extra'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AppModule } from '../../src/app.module.js'
import { ConfigService } from '../../src/core/config/config.service.js'
import { SocketIOAdapter } from '../../src/core/socket-io.adapter.js'
import { SpaFilter } from '../../src/core/spa/spa.filter.js'

describe('BasePath Configuration (e2e)', () => {
  let app: NestFastifyApplication
  let configService: ConfigService

  let authFilePath: string
  let secretsFilePath: string

  beforeAll(async () => {
    process.env.UIX_BASE_PATH = resolve(__dirname, '../../')
    process.env.UIX_STORAGE_PATH = resolve(__dirname, '../', '.homebridge')
    process.env.UIX_CONFIG_PATH = resolve(process.env.UIX_STORAGE_PATH, 'config.json')

    authFilePath = resolve(process.env.UIX_STORAGE_PATH, 'auth.json')
    secretsFilePath = resolve(process.env.UIX_STORAGE_PATH, '.uix-secrets')

    // Setup test config with basePath
    const testConfig = {
      bridge: {
        name: 'Homebridge Test',
        port: 51826,
        pin: '874-99-441',
        username: '67:E4:1F:0E:A0:5D',
      },
      accessories: [],
      platforms: [
        {
          name: 'Config',
          port: 8080,
          auth: 'form',
          standalone: true,
          platform: 'config',
          basePath: '/homebridge',
        },
      ],
    }

    await writeJSON(process.env.UIX_CONFIG_PATH, testConfig)

    // Setup test auth file
    await copy(resolve(__dirname, '../mocks', 'auth.json'), authFilePath)
    await copy(resolve(__dirname, '../mocks', '.uix-secrets'), secretsFilePath)

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    configService = moduleFixture.get<ConfigService>(ConfigService)

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter())

    // Apply the same configuration as in main.ts
    const basePath = configService.basePath
    const baseHref = basePath ? `${basePath}/` : '/'

    // Configure WebSocket adapter with basePath support
    app.useWebSocketAdapter(new SocketIOAdapter(app, configService))

    // Serve index.html without a cache at basePath
    app.getHttpAdapter().get(basePath || '/', async (req: FastifyRequest, res: FastifyReply) => {
      res.type('text/html')
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.header('Pragma', 'no-cache')
      res.header('Expires', '0')
      const indexHtml = await readFile(resolve(process.env.UIX_BASE_PATH, 'public/index.html'), 'utf-8')
      // eslint-disable-next-line e18e/prefer-static-regex
      const modifiedHtml = indexHtml.replace(/<base href="[^"]*"/, `<base href="${baseHref}"`)
      res.send(modifiedHtml)
    })

    // Serve static assets with basePath prefix (excluding index.html)
    app.useStaticAssets({
      root: resolve(process.env.UIX_BASE_PATH, 'public'),
      prefix: basePath || undefined,
      setHeaders(res) {
        res.setHeader('Cache-Control', 'public,max-age=31536000,immutable')
      },
      decorateReply: false,
      serve: true,
      wildcard: false,
      index: false,
    })

    // Set API prefix
    app.setGlobalPrefix(basePath ? `${basePath}/api` : '/api')

    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      skipMissingProperties: true,
    }))

    // Use the spa filter
    app.useGlobalFilters(new SpaFilter(configService))

    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  describe('Configuration Service', () => {
    it('should load basePath from config', () => {
      expect(configService.ui.basePath).toBe('/homebridge')
    })

    it('should normalize basePath correctly', () => {
      expect(configService.basePath).toBe('/homebridge')
    })
  })

  describe('UI Routes', () => {
    it('GET /homebridge should serve index.html with correct base href', async () => {
      const res = await app.inject({
        method: 'GET',
        path: '/homebridge',
      })

      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('text/html')
      expect(res.body).toContain('<base href="/homebridge/"')
    })

    it('GET /homebridge/ should serve index.html with correct base href', async () => {
      const res = await app.inject({
        method: 'GET',
        path: '/homebridge/',
      })

      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('text/html')
      expect(res.body).toContain('<base href="/homebridge/"')
    })

    it('should have no-cache headers for index.html', async () => {
      const res = await app.inject({
        method: 'GET',
        path: '/homebridge/',
      })

      expect(res.headers['cache-control']).toContain('no-cache')
      expect(res.headers.pragma).toBe('no-cache')
    })
  })

  describe('API Routes', () => {
    it('GET /homebridge/api/status/homebridge-version should be accessible', async () => {
      const res = await app.inject({
        method: 'GET',
        path: '/homebridge/api/status/homebridge-version',
      })

      // Should be 401 (unauthorized) not 404, meaning the route exists
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/status/homebridge-version (without basePath) should return 404 or HTML', async () => {
      const res = await app.inject({
        method: 'GET',
        path: '/api/status/homebridge-version',
      })

      // Should either be 404 or return HTML (caught by SPA filter)
      expect([404, 200]).toContain(res.statusCode)
      // Only check content-type when status is 200
      const isHtml = res.statusCode === 200 && res.headers['content-type']?.includes('text/html')
      const is404 = res.statusCode === 404
      expect(isHtml || is404).toBe(true)
    })
  })

  describe('Static Assets', () => {
    it('should serve static assets with basePath prefix', async () => {
      const res = await app.inject({
        method: 'GET',
        path: '/homebridge/favicon.ico',
      })

      // Should be 200 or 404 depending on if the file exists
      expect([200, 404]).toContain(res.statusCode)
    })

    it('should serve index.html as static file with original base href', async () => {
      const res = await app.inject({
        method: 'GET',
        path: '/homebridge/index.html',
      })

      // When directly requesting index.html, it's served as a static file
      // with long cache headers and original base href
      expect(res.statusCode).toBe(200)
      expect(res.body).toContain('<base href="/"') // Original, not modified
      expect(res.headers['cache-control']).toContain('max-age')
    })
  })

  describe('SPA Filter', () => {
    it('should serve index.html for non-API routes under basePath', async () => {
      const res = await app.inject({
        method: 'GET',
        path: '/homebridge/plugins',
      })

      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('text/html')
      expect(res.body).toContain('<base href="/homebridge/"')
    })

    it('should return 404 for API routes that do not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        path: '/homebridge/api/nonexistent',
      })

      expect(res.statusCode).toBe(404)
    })
  })

  afterAll(async () => {
    await app.close()
  })
})

describe('BasePath Normalization', () => {
  let app: NestFastifyApplication
  let configService: ConfigService

  const testCases = [
    { input: '/homebridge/', expected: '/homebridge', description: 'trailing slash removed' },
    { input: 'homebridge', expected: '/homebridge', description: 'leading slash added' },
    { input: '/homebridge', expected: '/homebridge', description: 'already normalized' },
    { input: '  /homebridge/  ', expected: '/homebridge', description: 'whitespace trimmed' },
    { input: '', expected: '', description: 'empty string results in empty' },
    { input: '/', expected: '', description: 'single slash results in empty' },
    { input: '/admin/homebridge', expected: '/admin/homebridge', description: 'deep path preserved' },
  ]

  for (const testCase of testCases) {
    it(`should normalize "${testCase.input}" to "${testCase.expected}" (${testCase.description})`, async () => {
      process.env.UIX_BASE_PATH = resolve(__dirname, '../../')
      process.env.UIX_STORAGE_PATH = resolve(__dirname, '../', '.homebridge')
      process.env.UIX_CONFIG_PATH = resolve(process.env.UIX_STORAGE_PATH, 'config.json')

      const authFilePath = resolve(process.env.UIX_STORAGE_PATH, 'auth.json')
      const secretsFilePath = resolve(process.env.UIX_STORAGE_PATH, '.uix-secrets')

      // Setup test config with specific basePath
      const testConfig = {
        bridge: {
          name: 'Homebridge Test',
          port: 51826,
          pin: '874-99-441',
          username: '67:E4:1F:0E:A0:5D',
        },
        platforms: [
          {
            name: 'Config',
            port: 8080,
            platform: 'config',
            basePath: testCase.input,
          },
        ],
      }

      await writeJSON(process.env.UIX_CONFIG_PATH, testConfig)
      await copy(resolve(__dirname, '../mocks', 'auth.json'), authFilePath)
      await copy(resolve(__dirname, '../mocks', '.uix-secrets'), secretsFilePath)

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile()

      configService = moduleFixture.get<ConfigService>(ConfigService)

      app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter())

      // Note: We don't need to set up routes here, just testing config parsing
      await app.init()

      expect(configService.basePath).toBe(testCase.expected)

      await app.close()
    })
  }
})

describe('BasePath with Root Path (backward compatibility)', () => {
  let app: NestFastifyApplication
  let configService: ConfigService

  beforeAll(async () => {
    process.env.UIX_BASE_PATH = resolve(__dirname, '../../')
    process.env.UIX_STORAGE_PATH = resolve(__dirname, '../', '.homebridge')
    process.env.UIX_CONFIG_PATH = resolve(process.env.UIX_STORAGE_PATH, 'config.json')

    const authFilePath = resolve(process.env.UIX_STORAGE_PATH, 'auth.json')
    const secretsFilePath = resolve(process.env.UIX_STORAGE_PATH, '.uix-secrets')

    // Setup test config WITHOUT basePath (should default to root)
    const testConfig = {
      bridge: {
        name: 'Homebridge Test',
        port: 51826,
        pin: '874-99-441',
        username: '67:E4:1F:0E:A0:5D',
      },
      platforms: [
        {
          name: 'Config',
          port: 8080,
          platform: 'config',
          // No basePath specified
        },
      ],
    }

    await writeJSON(process.env.UIX_CONFIG_PATH, testConfig)
    await copy(resolve(__dirname, '../mocks', 'auth.json'), authFilePath)
    await copy(resolve(__dirname, '../mocks', '.uix-secrets'), secretsFilePath)

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    configService = moduleFixture.get<ConfigService>(ConfigService)

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter())

    // Apply the same configuration as in main.ts
    const basePath = configService.basePath
    const baseHref = basePath ? `${basePath}/` : '/'

    // Configure WebSocket adapter with basePath support
    app.useWebSocketAdapter(new SocketIOAdapter(app, configService))

    // Serve index.html without a cache at basePath (root in this case)
    app.getHttpAdapter().get(basePath || '/', async (req: FastifyRequest, res: FastifyReply) => {
      res.type('text/html')
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.header('Pragma', 'no-cache')
      res.header('Expires', '0')
      const indexHtml = await readFile(resolve(process.env.UIX_BASE_PATH, 'public/index.html'), 'utf-8')
      // eslint-disable-next-line e18e/prefer-static-regex
      const modifiedHtml = indexHtml.replace(/<base href="[^"]*"/, `<base href="${baseHref}"`)
      res.send(modifiedHtml)
    })

    // Serve static assets (excluding index.html)
    app.useStaticAssets({
      root: resolve(process.env.UIX_BASE_PATH, 'public'),
      prefix: basePath || undefined,
      setHeaders(res) {
        res.setHeader('Cache-Control', 'public,max-age=31536000,immutable')
      },
      decorateReply: false,
      serve: true,
      wildcard: false,
      index: false,
    })

    // Set API prefix
    app.setGlobalPrefix(basePath ? `${basePath}/api` : '/api')

    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      skipMissingProperties: true,
    }))

    // Use the spa filter
    app.useGlobalFilters(new SpaFilter(configService))

    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  it('should default to empty basePath when not configured', () => {
    expect(configService.basePath).toBe('')
  })

  it('GET / should serve index.html with base href="/"', async () => {
    const res = await app.inject({
      method: 'GET',
      path: '/',
    })

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<base href="/"')
  })

  it('GET /api/status/homebridge-version should be accessible at root', async () => {
    const res = await app.inject({
      method: 'GET',
      path: '/api/status/homebridge-version',
    })

    // Should be 401 (unauthorized) not 404, meaning the route exists
    expect(res.statusCode).toBe(401)
  })

  afterAll(async () => {
    await app.close()
  })
})
