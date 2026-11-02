# aurlemon-intro-proxy

Cloudflare Worker proxy for AurLemon Intro upstream API requests.

## Features

- Validates handshake key before forwarding requests.
- Allows only required upstream routes:
  - GET https://api.bgm.tv/v0/users/:username/collections
  - POST https://github.com/login/oauth/access_token
  - GET https://api.github.com/users/:username
  - GET https://linux.do/u/:username.json
  - GET https://api.github.com/user
  - GET https://github.com/users/:username/contributions
  - POST https://connect.linux.do/oauth2/token
  - GET https://connect.linux.do/api/user
- Publicly proxies whitelisted Bangumi cover images without a handshake key:
  - GET /bangumi/image?url=https://lain.bgm.tv/r/400/pic/cover/...
- Wraps upstream response in a stable JSON envelope for backend parsing.
- Includes request diagnostics fields: requestId and durationMs.

Linux DO OAuth forwarding carries a client credential or short-lived access
token inside the encrypted request to this Worker. The Worker must not log
request headers or bodies, and its route allowlist must remain exact.

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

## Public GitHub / Linux DO avatar proxy

`GET /avatar?url=<encoded-https-avatar-url>` (also supports HEAD) proxies public
GitHub and Linux DO avatars without a handshake key. Only GitHub username PNGs,
`avatars.githubusercontent.com/u/:id` or `/in/:id`, Linux DO user / letter avatars (including `cdn.ldstatic.com`),
and `connect.linux.do/avatar/:size.png` are accepted. Each redirect is checked
against the same allowlist (up to three redirects); cookies and authorization
headers are never forwarded. Only raster image responses are returned as success.
Successful images use the existing one-day browser / seven-day shared cache
headers, with a one-day Cloudflare fetch cache. Failures are not given image cache
headers. Original image bytes and dimensions are preserved.

Deploy this Worker before enabling `NUXT_PUBLIC_SOCIAL_AVATAR_PROXY_URL` in Intro.
Intro uses the existing `INTRO_PROXY_URL` as the default public avatar proxy base;
only the public Worker URL is exposed, never the handshake key.
