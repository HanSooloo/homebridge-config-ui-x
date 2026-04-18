# Base Path Feature - Test Coverage

## Overview

Comprehensive test coverage has been added for the basePath feature. All tests use the Vitest framework following the existing repository patterns.

## Test Files

### E2E Tests

**File**: `test/e2e/basepath.e2e-spec.ts`

**Total Tests**: 21 passing ✅

## Test Coverage Details

### 1. Configuration Service Tests (2 tests)

Tests that verify the ConfigService correctly loads and normalizes the basePath configuration.

- ✅ Should load basePath from config.json
- ✅ Should normalize basePath correctly (remove trailing slashes, add leading slash)

### 2. UI Routes Tests (3 tests)

Tests that verify the UI is accessible at the configured basePath with proper base href injection.

- ✅ `GET /homebridge` should serve index.html with correct `<base href="/homebridge/">`
- ✅ `GET /homebridge/` should serve index.html with correct `<base href="/homebridge/">`
- ✅ Should have no-cache headers for index.html

### 3. API Routes Tests (2 tests)

Tests that verify API endpoints are correctly prefixed with the basePath.

- ✅ `GET /homebridge/api/status/homebridge-version` should be accessible (returns 401 auth required)
- ✅ `GET /api/status/homebridge-version` (without basePath) should return 404 or HTML

### 4. Static Assets Tests (2 tests)

Tests that verify static assets are served correctly under the basePath.

- ✅ Should serve static assets with basePath prefix
- ✅ Should serve index.html as static file with original base href when accessed directly

### 5. SPA Filter Tests (2 tests)

Tests that verify the SPA filter correctly handles client-side routing under basePath.

- ✅ Should serve index.html for non-API routes under basePath (e.g., `/homebridge/plugins`)
- ✅ Should return 404 for API routes that do not exist

### 6. BasePath Normalization Tests (7 tests)

Tests that verify various input formats are correctly normalized.

| Input               | Expected Output     | Test Status |
| ------------------- | ------------------- | ----------- |
| `/homebridge/`      | `/homebridge`       | ✅          |
| `homebridge`        | `/homebridge`       | ✅          |
| `/homebridge`       | `/homebridge`       | ✅          |
| `  /homebridge/  `  | `/homebridge`       | ✅          |
| `` (empty string)   | `` (empty)          | ✅          |
| `/`                 | `` (empty)          | ✅          |
| `/admin/homebridge` | `/admin/homebridge` | ✅          |

### 7. Backward Compatibility Tests (3 tests)

Tests that verify the application works correctly when no basePath is configured (root path deployment).

- ✅ Should default to empty basePath when not configured
- ✅ `GET /` should serve index.html with `<base href="/">`
- ✅ `GET /api/status/homebridge-version` should be accessible at root

## Running the Tests

### Run all basePath tests:

```bash
npm test -- test/e2e/basepath.e2e-spec.ts
```

### Run all e2e tests:

```bash
npm test
```

## Test Coverage Summary

| Category               | Tests  | Status              |
| ---------------------- | ------ | ------------------- |
| Configuration          | 2      | ✅ All passing      |
| UI Routes              | 3      | ✅ All passing      |
| API Routes             | 2      | ✅ All passing      |
| Static Assets          | 2      | ✅ All passing      |
| SPA Filter             | 2      | ✅ All passing      |
| Normalization          | 7      | ✅ All passing      |
| Backward Compatibility | 3      | ✅ All passing      |
| **Total**              | **21** | **✅ 100% passing** |

## What is NOT Tested

The following scenarios are tested through manual browser testing but not automated:

1. **WebSocket connections** - Socket.io handshake and message passing
2. **Real browser behavior** - Asset loading, CSP headers, actual Angular routing
3. **Reverse proxy scenarios** - Nginx, Apache, Traefik configurations
4. **mDNS service advertisement** - Bonjour/Avahi service discovery with basePath

These are difficult to test in the unit/e2e test environment but have been verified through manual testing (see `TEST_RESULTS.md`).

## Test Implementation Details

### Test Setup

Each test suite:

1. Creates a temporary test config with the desired basePath
2. Initializes the NestJS application with the same bootstrap logic as `main.ts`
3. Applies the same middleware, filters, and route handlers
4. Uses Fastify's `inject` method to simulate HTTP requests

### Key Testing Patterns

**Config Setup**:

```typescript
// Example from test file - shows how test config is structured
// const testConfig = {
//   platforms: [{
//     platform: 'config',
//     basePath: '/homebridge'
//   }]
// }
// await writeJSON(process.env.UIX_CONFIG_PATH, testConfig)
```

**Route Testing**:

```typescript
// Example from test file
// const res = await app.inject({
//   method: 'GET',
//   path: '/homebridge/',
// })
// expect(res.statusCode).toBe(200)
// expect(res.body).toContain('<base href="/homebridge/"')
```

**Normalization Testing**:

```typescript
// Example from test file
// configService = moduleFixture.get<ConfigService>(ConfigService)
// expect(configService.basePath).toBe('/homebridge')
```

## Future Test Improvements

Potential areas for additional test coverage:

1. **WebSocket E2E Tests** - Test socket.io connections with basePath
2. **Swagger Documentation** - Verify swagger UI loads correctly at basePath
3. **Browser E2E Tests** - Use Playwright/Cypress to test real browser behavior
4. **Performance Tests** - Ensure basePath doesn't impact performance
5. **Security Tests** - Verify path traversal attempts are blocked

## Related Documentation

- `TEST_RESULTS.md` - Manual testing results and verification
- `BASEPATH.md` - End-user documentation for basePath configuration
- `test-basepath.sh` - Shell script for manual endpoint testing
