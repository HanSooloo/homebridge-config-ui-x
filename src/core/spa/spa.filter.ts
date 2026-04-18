import type { ArgumentsHost, ExceptionFilter, HttpException } from '@nestjs/common'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

import { Catch, Injectable, NotFoundException } from '@nestjs/common'

import { ConfigService } from '../config/config.service.js'

// Regex for replacing base href in HTML
const BASE_HREF_REGEX = /<base href="[^"]*"/

@Catch(NotFoundException)
@Injectable()
export class SpaFilter implements ExceptionFilter {
  constructor(private readonly configService: ConfigService) {}

  catch(_exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const req = ctx.getRequest()
    const res = ctx.getResponse()

    const basePath = this.configService.basePath
    const baseHref = basePath ? `${basePath}/` : '/'

    // Check if the request is for API, socket.io, or static assets
    // Account for basePath in the check
    const apiPath = basePath ? `${basePath}/api/` : '/api/'
    const socketPath = basePath ? `${basePath}/socket.io` : '/socket.io'
    const assetsPath = basePath ? `${basePath}/assets` : '/assets'

    if (req.url.startsWith(apiPath) || req.url.startsWith(socketPath) || req.url.startsWith(assetsPath)) {
      return res.code(404).send('Not Found')
    }

    const file = readFileSync(resolve(process.env.UIX_BASE_PATH, 'public/index.html'), 'utf-8')
    const modifiedHtml = file.replace(BASE_HREF_REGEX, `<base href="${baseHref}"`)
    res.type('text/html')
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.header('Pragma', 'no-cache')
    res.header('Expires', '0')
    res.send(modifiedHtml)
  }
}
