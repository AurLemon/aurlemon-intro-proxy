# github-proxy

Cloudflare Worker proxy for GitHub OAuth and contributions endpoints.

## Features

- Validates handshake key before forwarding requests.
- Allows only required GitHub upstream routes:
  - POST https://github.com/login/oauth/access_token
  - GET https://api.github.com/user
  - GET https://github.com/users/:username/contributions
- Wraps upstream response in a stable JSON envelope for backend parsing.
- Includes request diagnostics fields: requestId and durationMs.

## Environment

Set one of these secret keys in Cloudflare Worker environment:

- GITHUB_PROXY_HANDSHAKE_KEY (recommended)
- OAUTH_PROXY_KEY (compatibility)
- PROXY_KEY (compatibility)

## Local development

```bash
cd github-proxy
pnpm install
pnpm cf:dev
```

Default local endpoint is typically http://127.0.0.1:8787.

## Deploy

```bash
cd github-proxy
pnpm install
pnpm cf:deploy
```

Set secret before deploy:

```bash
wrangler secret put GITHUB_PROXY_HANDSHAKE_KEY
```

See docs/Usage.md for request and response format.
