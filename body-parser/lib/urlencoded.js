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
const { parse: doParse } = require("querystring")

function hasbody(req) {
  return (
    req.headers["transfer-encoding"] !== undefined ||
    !isNaN(req.headers["content-length"])
  )
}

module.exports = function urlencoded(options) {
  const opts = options || {}

  const inflate = opts.inflate !== false
  const limit =
    typeof opts.limit !== "number"
      ? bytes.parse(opts.limit || "100kb")
      : opts.limit
  const verify = opts.verify || false

  if (verify !== false && typeof verify !== "function") {
    throw new TypeError("option verify must be function")
  }

  // create the appropriate query parser
  const queryparse = simpleparser(opts)

  function parse(body) {
    return body.length ? queryparse(body) : {}
  }

  return function urlencodedParser(req, res, next) {
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

    // assert charset
    const charset = getCharset(req) || "utf-8"
    if (charset !== "utf-8") {
      next(
        createError(415, `unsupported charset "${charset.toUpperCase()}"`, {
          charset: charset,
          type: "charset.unsupported",
        })
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

function getCharset(req) {
  try {
    return (contentType.parse(req).parameters.charset || "").toLowerCase()
  } catch (e) {
    return undefined
  }
}

function parameterCount(body, limit) {
  let count = 0
  let index = 0

  while ((index = body.indexOf("&", index)) !== -1) {
    count++
    index++

    if (count === limit) {
      return undefined
    }
  }

  return count
}

function simpleparser(options) {
  let parameterLimit =
    options.parameterLimit !== undefined ? options.parameterLimit : 1000

  if (isNaN(parameterLimit) || parameterLimit < 1) {
    throw new TypeError("option parameterLimit must be a positive number")
  }

  if (isFinite(parameterLimit)) {
    parameterLimit = parameterLimit | 0
  }

  return function queryparse(body) {
    const paramCount = parameterCount(body, parameterLimit)

    if (paramCount === undefined) {
      throw createError(413, "too many parameters", {
        type: "parameters.too.many",
      })
    }

    return doParse(body, undefined, undefined, { maxKeys: parameterLimit })
  }
}
