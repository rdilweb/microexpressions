/*!
 * finalhandler
 * Copyright(c) 2014-2017 Douglas Christopher Wilson
 * MIT Licensed
 */

const debug = require("debug")("finalhandler")
const onFinished = require("on-finished")
const { URL } = require("url")
const statuses = require("statuses")
const unpipe = require("unpipe")

const isFinished = onFinished.isFinished

/**
 * Create a function to handle the final response.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {Object} [options]
 */
function finalhandler(req, res, options) {
  const opts = options || {}

  // get environment
  const env = opts.env || process.env.NODE_ENV || "development"

  // get error callback
  const onerror = opts.onerror

  return function (err) {
    let headers
    let msg
    let status

    // ignore 404 on in-flight response
    if (!err && headersSent(res)) {
      debug("cannot 404 after headers sent")
      return
    }

    // unhandled error
    if (err) {
      // respect status code from error
      status = getErrorStatusCode(err)

      if (status === undefined) {
        // fallback to status code on response
        status = getResponseStatusCode(res)
      } else {
        // respect headers from error
        headers = getErrorHeaders(err)
      }

      // get error message
      msg = getErrorMessage(err, status, env)
    } else {
      // not found
      status = 404
      msg = `Cannot ${req.method} ${getResourceName(req)}`
    }

    debug("default %s", status)

    // schedule onerror callback
    if (err && onerror) {
      setImmediate(onerror, err, req, res)
    }

    // cannot actually respond
    if (headersSent(res)) {
      debug("cannot %d after headers sent", status)
      req.socket.destroy()
      return
    }

    // send response
    send(req, res, status, headers, msg)
  }
}

function getErrorHeaders(err) {
  if (!err.headers || typeof err.headers !== "object") {
    return undefined
  }

  const headers = Object.create(null)
  const keys = Object.keys(err.headers)

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    headers[key] = err.headers[key]
  }

  return headers
}

function getErrorMessage(err, status, env) {
  let msg

  if (env !== "production") {
    // use err.stack, which typically includes err.message
    msg = err.stack

    // fallback to err.toString() when possible
    if (!msg && typeof err.toString === "function") {
      msg = err.toString()
    }
  }

  return msg || statuses.message[status]
}

function getErrorStatusCode(err) {
  // check err.status
  if (typeof err.status === "number" && err.status >= 400 && err.status < 600) {
    return err.status
  }

  // check err.statusCode
  if (
    typeof err.statusCode === "number" &&
    err.statusCode >= 400 &&
    err.statusCode < 600
  ) {
    return err.statusCode
  }

  return undefined
}

function getResourceName(req) {
  try {
    return new URL(req.url).pathname
  } catch (e) {
    return "resource"
  }
}

function getResponseStatusCode(res) {
  let status = res.statusCode

  // default status code to 500 if outside valid range
  if (typeof status !== "number" || status < 400 || status > 599) {
    status = 500
  }

  return status
}

function headersSent(res) {
  return typeof res.headersSent !== "boolean"
    ? Boolean(res._header)
    : res.headersSent
}

function send(req, res, status, headers, message) {
  function write() {
    // response body
    const body = message

    // response status
    res.statusCode = status
    res.statusMessage = statuses.message[status]

    // response headers
    setHeaders(res, headers)

    // security headers
    res.setHeader("Content-Security-Policy", "default-src 'none'")
    res.setHeader("X-Content-Type-Options", "nosniff")

    // standard headers
    res.setHeader("Content-Type", "text/plain; charset=utf-8")
    res.setHeader("Content-Length", Buffer.byteLength(body, "utf8"))

    if (req.method === "HEAD") {
      res.end()
      return
    }

    res.end(body, "utf8")
  }

  if (isFinished(req)) {
    write()
    return
  }

  // unpipe everything from the request
  unpipe(req)

  // flush the request
  onFinished(req, write)
  req.resume()
}

function setHeaders(res, headers) {
  if (!headers) {
    return
  }

  const keys = Object.keys(headers)
  for (const key of keys) {
    res.setHeader(key, headers[key])
  }
}

module.exports = finalhandler
