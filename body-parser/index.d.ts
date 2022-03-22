/// <reference types="node" />

import { NextFunction, Response, Request } from "express"

export interface JsonOptions {
  /**
   * Controls the maximum request body size. If this is a number,
   * then the value specifies the number of bytes; if it is a string,
   * the value is passed to the bytes library for parsing. Defaults to '100kb'.
   */
  limit?: number | string
}

export interface UrlEncodedOptions {
  /**
   * Controls the maximum request body size. If this is a number,
   * then the value specifies the number of bytes; if it is a string,
   * the value is passed to the bytes library for parsing. Defaults to '100kb'.
   */
  limit?: number | string
}

/**
 * Function that returns a middleware function that populates the request's `body` property.
 *
 * @param options The options.
 */
export declare function json(options?: JsonOptions): (req: Request, res: Response, next: NextFunction) => void

export declare function urlencoded(options?: UrlEncodedOptions): (req: Request, res: Response, next: NextFunction) => void
