const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }
const DEFAULT_TIMEOUT_MS = 15_000
const MAX_TIMEOUT_MS = 20_000

const FORWARD_HEADER_DENYLIST = new Set([
  'host',
  'connection',
  'content-length',
  'cf-connecting-ip',
  'x-forwarded-for',
  'x-real-ip',
  'cookie',
  'set-cookie',
])

const ROUTE_DEFINITIONS = [
  {
    host: 'github.com',
    method: 'POST',
    path: /^\/login\/oauth\/access_token$/,
    validateQuery: (urlObj) => urlObj.searchParams.size === 0,
  },
  {
    host: 'api.github.com',
    method: 'GET',
    path: /^\/user$/,
    validateQuery: (urlObj) => urlObj.searchParams.size === 0,
  },
  {
    host: 'github.com',
    method: 'GET',
    path: /^\/users\/[a-z\d](?:[a-z\d-]{0,38})\/contributions$/i,
    validateQuery: (urlObj) => {
      const allowed = new Set(['from', 'to'])
      for (const [key, value] of urlObj.searchParams.entries()) {
        if (!allowed.has(key)) {
          return false
        }
        if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return false
        }
      }
      return true
    },
  },
]

const toError = (error) => {
  if (!error || typeof error !== 'object') {
    return {
      name: undefined,
      message: undefined,
    }
  }

  return {
    name: typeof error.name === 'string' ? error.name : undefined,
    message: typeof error.message === 'string' ? error.message : undefined,
  }
}

const createRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const jsonResponse = (payload, status = 200) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  })
}

const createErrorEnvelope = ({
  requestId,
  startedAt,
  status,
  error,
  body = undefined,
}) => ({
  ok: false,
  status,
  error,
  bodyType: 'text',
  body: body ?? error,
  requestId,
  durationMs: Date.now() - startedAt,
})

const resolveProxyKey = (env) => {
  const value =
    env.GITHUB_PROXY_HANDSHAKE_KEY || env.OAUTH_PROXY_KEY || env.PROXY_KEY || ''

  return typeof value === 'string' ? value.trim() : ''
}

const normalizeIncomingKey = (value) => {
  return typeof value === 'string' ? value.trim() : ''
}

const clampTimeout = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs)) {
    return DEFAULT_TIMEOUT_MS
  }

  const parsed = Math.floor(timeoutMs)
  if (parsed < 1_000) {
    return 1_000
  }

  if (parsed > MAX_TIMEOUT_MS) {
    return MAX_TIMEOUT_MS
  }

  return parsed
}

const normalizeUpstreamMethod = (method) => {
  if (typeof method !== 'string') {
    return 'GET'
  }

  return method.trim().toUpperCase() || 'GET'
}

const normalizeUpstreamHeaders = (headers) => {
  const result = {}

  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return result
  }

  for (const [rawKey, rawValue] of Object.entries(headers)) {
    if (typeof rawKey !== 'string') {
      continue
    }

    const key = rawKey.trim().toLowerCase()
    if (!key || FORWARD_HEADER_DENYLIST.has(key)) {
      continue
    }

    if (typeof rawValue !== 'string') {
      continue
    }

    result[key] = rawValue
  }

  return result
}

const pickResponseHeaders = (headers) => {
  const keep = new Set([
    'content-type',
    'cache-control',
    'etag',
    'expires',
    'last-modified',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
    'x-ratelimit-resource',
    'x-ratelimit-used',
  ])

  const result = {}

  headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (keep.has(lower)) {
      result[lower] = value
    }
  })

  return result
}

const toBase64 = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''

  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }

  return btoa(binary)
}

const buildUpstreamBody = (payload, method) => {
  if (method === 'GET' || method === 'HEAD') {
    return undefined
  }

  if (payload.body == null) {
    return undefined
  }

  if (payload.bodyType === 'json') {
    if (typeof payload.body === 'string') {
      return payload.body
    }

    return JSON.stringify(payload.body)
  }

  if (payload.bodyType === 'base64' && typeof payload.body === 'string') {
    return atob(payload.body)
  }

  if (typeof payload.body === 'string') {
    return payload.body
  }

  return JSON.stringify(payload.body)
}

const matchAllowedRoute = (urlObj, method) => {
  return ROUTE_DEFINITIONS.some((route) => {
    if (route.host !== urlObj.hostname) {
      return false
    }

    if (route.method !== method) {
      return false
    }

    if (!route.path.test(urlObj.pathname)) {
      return false
    }

    return route.validateQuery(urlObj)
  })
}

const parsePayload = async (request) => {
  try {
    return await request.json()
  } catch {
    return null
  }
}

const parseUpstreamResponse = async (upstreamResponse) => {
  if (upstreamResponse.status === 204 || upstreamResponse.status === 304) {
    return {
      bodyType: 'empty',
      body: null,
    }
  }

  const contentType = (upstreamResponse.headers.get('content-type') || '').toLowerCase()

  if (contentType.includes('application/json')) {
    return {
      bodyType: 'json',
      body: await upstreamResponse.text(),
    }
  }

  if (
    contentType.startsWith('text/') ||
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('application/xml')
  ) {
    return {
      bodyType: 'text',
      body: await upstreamResponse.text(),
    }
  }

  return {
    bodyType: 'binary',
    body: toBase64(await upstreamResponse.arrayBuffer()),
  }
}

const createUpstreamEnvelope = ({
  upstreamResponse,
  bodyType,
  body,
  requestId,
  startedAt,
}) => ({
  ok: upstreamResponse.ok,
  status: upstreamResponse.status,
  headers: pickResponseHeaders(upstreamResponse.headers),
  bodyType,
  body,
  requestId,
  durationMs: Date.now() - startedAt,
})

export default {
  async fetch(request, env) {
    const requestId = createRequestId()
    const startedAt = Date.now()
    const urlObj = new URL(request.url)

    if (request.method !== 'POST' || urlObj.pathname !== '/') {
      return jsonResponse(
        createErrorEnvelope({
          requestId,
          startedAt,
          status: 404,
          error: 'Not Found',
        }),
        404,
      )
    }

    const payload = await parsePayload(request)

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return jsonResponse(
        createErrorEnvelope({
          requestId,
          startedAt,
          status: 400,
          error: 'Invalid JSON body',
        }),
        400,
      )
    }

    const proxyKey = resolveProxyKey(env)
    const clientKey = normalizeIncomingKey(payload.key)

    if (!proxyKey || clientKey !== proxyKey) {
      return jsonResponse(
        createErrorEnvelope({
          requestId,
          startedAt,
          status: 401,
          error: 'Invalid proxy key',
          body: 'Invalid proxy key',
        }),
        401,
      )
    }

    if (typeof payload.url !== 'string' || !payload.url.trim()) {
      return jsonResponse(
        createErrorEnvelope({
          requestId,
          startedAt,
          status: 400,
          error: 'Invalid upstream url',
        }),
        400,
      )
    }

    let upstreamUrl

    try {
      upstreamUrl = new URL(payload.url)
    } catch {
      return jsonResponse(
        createErrorEnvelope({
          requestId,
          startedAt,
          status: 400,
          error: 'Invalid upstream url',
        }),
        400,
      )
    }

    if (upstreamUrl.protocol !== 'https:') {
      return jsonResponse(
        createErrorEnvelope({
          requestId,
          startedAt,
          status: 400,
          error: 'Only https upstream is allowed',
        }),
        400,
      )
    }

    const method = normalizeUpstreamMethod(payload.method)

    if (!matchAllowedRoute(upstreamUrl, method)) {
      return jsonResponse(
        createErrorEnvelope({
          requestId,
          startedAt,
          status: 403,
          error: 'Upstream target is not allowed',
        }),
        403,
      )
    }

    const timeoutMs = clampTimeout(payload.timeoutMs)
    const forwardedHeaders = normalizeUpstreamHeaders(payload.headers)
    const upstreamBody = buildUpstreamBody(payload, method)

    if (payload.bodyType === 'json' && !forwardedHeaders['content-type']) {
      forwardedHeaders['content-type'] = 'application/json'
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    let upstreamResponse

    try {
      upstreamResponse = await fetch(upstreamUrl.toString(), {
        method,
        headers: new Headers(forwardedHeaders),
        body: upstreamBody,
        signal: controller.signal,
      })
    } catch (error) {
      clearTimeout(timeoutId)

      const basicError = toError(error)
      const timeoutError = basicError.name === 'AbortError'

      return jsonResponse(
        createErrorEnvelope({
          requestId,
          startedAt,
          status: timeoutError ? 504 : 502,
          error: timeoutError
            ? 'Upstream request timeout'
            : 'Upstream request failed',
          body: basicError.message,
        }),
        timeoutError ? 504 : 502,
      )
    }

    clearTimeout(timeoutId)

    try {
      const { bodyType, body } = await parseUpstreamResponse(upstreamResponse)

      return jsonResponse(
        createUpstreamEnvelope({
          upstreamResponse,
          bodyType,
          body,
          requestId,
          startedAt,
        }),
        200,
      )
    } catch (error) {
      const basicError = toError(error)

      return jsonResponse(
        createErrorEnvelope({
          requestId,
          startedAt,
          status: 502,
          error: 'Failed to read upstream response',
          body: basicError.message,
        }),
        502,
      )
    }
  },
}
