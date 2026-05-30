# aurlemon-intro-proxy

Cloudflare Worker proxy for AurLemon Intro upstream API requests.

## Features

- Validates handshake key before forwarding requests.
- Allows only required upstream routes:
  - GET https://api.bgm.tv/v0/users/:username/collections
  - POST https://github.com/login/oauth/access_token
  - GET https://api.github.com/user
  - GET https://github.com/users/:username/contributions
- Wraps upstream response in a stable JSON envelope for backend parsing.
- Includes request diagnostics fields: requestId and durationMs.

## Environment

Set the secret key in Cloudflare Worker environment:

- INTRO_PROXY_HANDSHAKE_KEY

## Local development

```bash
cd aurlemon-intro-proxy
pnpm install
pnpm cf:dev
```

Default local endpoint is typically http://127.0.0.1:8787.

## Deploy

```bash
cd aurlemon-intro-proxy
pnpm install
pnpm cf:deploy
```

Set secret before deploy:

```bash
wrangler secret put INTRO_PROXY_HANDSHAKE_KEY
```

See docs/Usage.md for request and response format.
