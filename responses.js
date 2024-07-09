import * as config from './config.js'

export const ok = (content) => json(content ?? 'ok', 200)
export const badRequest = (message) => json(message ?? 'bad_request', 400)
export const notFound = (message) => json(message ?? 'not_found', 404)
export const internalError = (exception) => json(toError(exception), 500)
export const json = (content, status) =>
  mime(
    serialize(content),
    'application/json',
    status,
  )
export const mime = ({ content, mimeType, encoding, status }) => {
  const headers = {
    'Content-Type': mimeType,
  }
  if (encoding) {
    headers['Content-Encoding'] = encoding
  }
  return new Response(content, {
    status: status || 200,
    headers,
  })
}

const serialize = config.INDENT_RESPONSES ? (v) => JSON.stringify(v, null, 2) : (v) => JSON.stringify(v)

const toError = (v) => {
  if (!v) {
    return 'internal_error'
  }
  if (typeof v !== 'object' || !v.name || !v.message || !v.stack) {
    // Custom object
    return v
  }
  // Has the shape of an exception, separate and return
  return {
    name: v.name,
    message: v.message,
    stackTrace: v.stack,
  }
}
