/*!
 * body-parser
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

const bytes = require("bytes")
const contentType = require("content-type")
const createError = require("http-errors")
const read = require("./read")
const bourne = require("@hapi/bourne")

const safeParse = bourne.parse

function hasbody(req) {
  return (
    req.headers["transfer-encoding"] !== undefined ||
    !isNaN(req.headers["content-length"])
  )
}

const FIRST_CHAR_REGEXP = /^[\x20\x09\x0a\x0d]*(.)/ // eslint-disable-line no-control-regex

module.exports = function json(options) {
  const opts = options || {}

  const limit =
    typeof opts.limit !== "number"
      ? bytes.parse(opts.limit || "100kb")
      : opts.limit
  const inflate = opts.inflate !== false
  const reviver = opts.reviver
  const strict = opts.strict !== false
  const verify = opts.verify || false

  if (verify !== false && typeof verify !== "function") {
    throw new TypeError("option verify must be function")
  }

  function parse(body) {
    if (body.length === 0) {
      // special-case empty json body, as it's a common client-side mistake
      return {}
    }

    if (strict) {
      const first = firstchar(body)

      if (first !== "{" && first !== "[") {
        throw createStrictSyntaxError(body, first)
      }
    }

    try {
      return safeParse(body, reviver)
    } catch (e) {
      throw normalizeJsonSyntaxError(e, {
        message: e.message,
        stack: e.stack,
      })
    }
  }

  return function jsonParser(req, res, next) {
    if (req._body) {
      next()
      return
    }

    req.body = req.body || {}

    // skip requests without bodies
    if (!hasbody(req)) {
      next()
      return
    }

    // assert charset per RFC 7159 sec 8.1
    const charset = getCharset(req) || "utf-8"
    if (charset.substr(0, 4) !== "utf-") {
      next(
        createError(
          415,
          'unsupported charset "' + charset.toUpperCase() + '"',
          {
            charset: charset,
            type: "charset.unsupported",
          }
        )
      )
      return
    }

    // read
    read(req, res, next, parse, {
      encoding: charset,
      inflate: inflate,
      limit: limit,
      verify: verify,
    })
  }
}

function createStrictSyntaxError(str, char) {
  const index = str.indexOf(char)
  const partial = str.substring(0, index) + "#"

  // noinspection ExceptionCaughtLocallyJS
  try {
    JSON.parse(partial)
    throw new SyntaxError("strict violation")
  } catch (e) {
    return normalizeJsonSyntaxError(e, {
      message: e.message.replace("#", char),
      stack: e.stack,
    })
  }
}

function firstchar(str) {
  return FIRST_CHAR_REGEXP.exec(str)[1]
}

function getCharset(req) {
  try {
    return (contentType.parse(req).parameters.charset || "").toLowerCase()
  } catch (e) {
    return undefined
  }
}

function normalizeJsonSyntaxError(error, obj) {
  const keys = Object.getOwnPropertyNames(error)

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (key !== "stack" && key !== "message") {
      delete error[key]
    }
  }

  error.stack = obj.stack
  error.message = obj.message

  return error
}
