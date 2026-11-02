# Usage

## Request contract

The worker accepts only POST / with JSON body:

```json
{
  "key": "your-intro-proxy-handshake-key",
  "url": "https://api.bgm.tv/v0/users/AurLemon/collections?subject_type=2&type=3&limit=100&offset=0",
  "method": "GET",
  "headers": {
    "accept": "application/json"
  },
  "timeoutMs": 12000
}
```

## Success envelope

```json
{
  "ok": true,
  "status": 200,
  "headers": {
    "content-type": "application/json; charset=utf-8"
  },
  "bodyType": "json",
  "body": "{\"access_token\":\"...\"}",
  "requestId": "f735f770-9374-42b6-996c-ec3e4e92ca7a",
  "durationMs": 281
}
```

## Error envelope

Validation and handshake failures use normal HTTP 4xx/5xx and still return JSON envelope:

```json
{
  "ok": false,
  "status": 401,
  "error": "Invalid proxy key",
  "bodyType": "text",
  "body": "Invalid proxy key",
  "requestId": "f735f770-9374-42b6-996c-ec3e4e92ca7a",
  "durationMs": 3
}
```

## Allowed upstream routes

- POST https://github.com/login/oauth/access_token
- GET https://api.github.com/users/:username
- GET https://linux.do/u/:username.json
- GET https://api.github.com/user
- GET https://github.com/users/:username/contributions?from=YYYY-MM-DD&to=YYYY-MM-DD
- GET https://api.bgm.tv/v0/users/:username/collections?subject_type=1|2&type=1|2|3&limit=1..100&offset=0..
- POST https://connect.linux.do/oauth2/token
- GET https://connect.linux.do/api/user

Query keys for contributions are restricted to from and to.
Query keys for Bangumi collections are restricted to subject_type, type, limit, and offset.
Linux DO OAuth routes do not accept query parameters.

The Linux DO token exchange forwards a Basic authorization header and an
authorization code. Treat both request headers and bodies as secrets: do not
add request logging to the Worker or any surrounding edge log pipeline.

## Public Bangumi image proxy

Bangumi cover images can be fetched without a handshake key:

```text
GET /bangumi/image?url=https%3A%2F%2Flain.bgm.tv%2Fr%2F400%2Fpic%2Fcover%2Fl%2Ff6%2F0f%2F604826_2XWRN.jpg
```

Only HTTPS `lain.bgm.tv` cover image paths are allowed.

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

## Correlated diagnostics

The Intro backend sends random UUID headers `x-intro-proxy-request-id` and
`x-intro-proxy-trace-id`. The Worker accepts only UUID-shaped diagnostic IDs,
keeps its own independent `requestId`, and returns it in
`x-intro-proxy-worker-id` as well as the existing envelope. No identity or
credentials are derived from these IDs, and neither header is forwarded upstream.

`INTRO_PROXY_DIAGNOSTICS=true` enables `INTRO_PROXY_REQUEST_RECEIVED`,
`INTRO_PROXY_UPSTREAM_STARTED` and all `INTRO_PROXY_WORKER_COMPLETED` records.
Failures and requests taking at least one second are logged even when disabled.
The checked-in Wrangler config enables structured Workers Logs at full sampling
and this variable, while disabling automatic invocation logs. No deployment is
performed by changing local files. Check retention and log ingestion limits in
your account when deploying. Set the variable to false after detailed diagnosis
if only slow and failed requests are needed.

Records contain `requestId`, `clientRequestId`, `traceId`, CF `colo` / ray,
`phase`, outer and upstream statuses, `durationMs`, `upstreamStartedMs`,
`upstreamHeadersMs`, `upstreamBodyMs`, GitHub request ID and remaining rate limit.
The headers timer includes upstream connection / TLS and time to response headers,
not just GitHub execution. The existing envelope duration measures the whole
Worker operation. The backend total minus this duration also includes network,
EO, queueing and response transfer, so it cannot isolate EO latency.

Search backend `requestId` as Worker `clientRequestId`, or search the shared
OAuth `traceId`. If an outer 525 has no matching Worker receipt, investigate the
path before Worker execution, while allowing for log loss or collection errors.
These records do not reveal EO's selected origin IP and cannot alone prove
which network hop failed.

Never log request or response bodies, authorization / cookie headers, handshake
keys, OAuth codes / state, tokens, emails, public lookup usernames or query
strings. Worker operation names are fixed categories rather than request URLs.
