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
- GET https://api.github.com/user
- GET https://github.com/users/:username/contributions?from=YYYY-MM-DD&to=YYYY-MM-DD
- GET https://api.bgm.tv/v0/users/:username/collections?subject_type=1|2&type=1|2|3&limit=1..100&offset=0..

Query keys for contributions are restricted to from and to.
Query keys for Bangumi collections are restricted to subject_type, type, limit, and offset.
