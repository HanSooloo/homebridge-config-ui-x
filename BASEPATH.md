# Base Path Configuration

## Overview

The Homebridge UI can now be hosted under a relative path (e.g., `/homebridge`) instead of only at the root path (`/`). This is useful when running behind a reverse proxy or when you need to host the UI alongside other services.

## Configuration

To configure a base path, add the `basePath` option to your Homebridge `config.json` file:

```json
{
  "bridge": {
    "name": "Homebridge",
    "username": "...",
    "port": 51826,
    "pin": "..."
  },
  "platforms": [
    {
      "platform": "config",
      "name": "Config",
      "port": 8581,
      "basePath": "/homebridge"
    }
  ]
}
```

## Important Notes

1. **Format**: The `basePath` should start with a forward slash (`/`) but not end with one
   - ✅ Good: `/homebridge`, `/ui`, `/admin/homebridge`
   - ❌ Bad: `homebridge`, `/homebridge/`, `homebridge/`

2. **Normalization**: The application will automatically normalize your basePath:
   - Leading slash will be added if missing
   - Trailing slashes will be removed
   - Empty strings or just slashes will result in root path (`/`)

3. **Access URLs**: When configured with a basePath, your URLs will change:
   - UI: `http://your-server:8581/homebridge/`
   - API: `http://your-server:8581/homebridge/api/`
   - Swagger: `http://your-server:8581/homebridge/swagger/`
   - WebSocket: `http://your-server:8581/homebridge/socket.io/`

## Reverse Proxy Examples

### Nginx

```nginx
location /homebridge/ {
    proxy_pass http://localhost:8581/homebridge/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Apache

```apache
<Location /homebridge/>
    ProxyPass http://localhost:8581/homebridge/
    ProxyPassReverse http://localhost:8581/homebridge/
    ProxyPreserveHost On
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteRule /(.*) ws://localhost:8581/homebridge/$1 [P,L]
</Location>
```

### Traefik

```yaml
http:
  routers:
    homebridge:
      rule: PathPrefix(`/homebridge`)
      service: homebridge
  services:
    homebridge:
      loadBalancer:
        servers:
          - url: 'http://localhost:8581'
```

## Upgrading from Root Path

If you're currently running Homebridge UI at the root path and want to move it to a base path:

1. Add `basePath` to your `config.json`
2. Restart Homebridge UI
3. Update your bookmarks and reverse proxy configuration
4. The UI will now be accessible at `http://your-server:8581/<basePath>/`

## Troubleshooting

### Assets not loading

- Ensure your reverse proxy is configured to pass through the full path including the basePath
- Check that your reverse proxy preserves the trailing slash in the basePath

### WebSocket connection fails

- Verify that your reverse proxy supports WebSocket upgrades
- Check that the WebSocket path includes the basePath: `<basePath>/socket.io/`

### API calls fail

- All API endpoints are now under `<basePath>/api/` instead of `/api/`
- The frontend automatically adjusts based on the `<base href>` tag
