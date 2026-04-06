# Usage

## Request contract

The worker accepts only POST / with JSON body:

```json
{
  "key": "your-handshake-key",
  "url": "https://github.com/login/oauth/access_token",
  "method": "POST",
  "headers": {
    "accept": "application/json",
    "content-type": "application/x-www-form-urlencoded"
  },
  "bodyType": "raw",
  "body": "client_id=...&client_secret=...&code=...",
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

Query keys for contributions are restricted to from and to.
