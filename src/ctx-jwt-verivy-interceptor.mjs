import jwt from "jsonwebtoken";
import { promisify } from "util";

import { Interceptor } from "@kronos-integration/interceptor";
import { mergeAttributes, createAttributes } from 'model-attributes';


const verifyPromisified = promisify(jwt.verify);

/**
 * only forward requests if a valid jwt token is present
 */
export class CTXJWTVerifyInterceptor extends Interceptor {
  /**
   * @return {string} 'ctx-jwt-verify'
   */
  static get name() {
    return "ctx-jwt-verify";
  }

  static get configurationAttributes() {
    return mergeAttributes(
      createAttributes({
        key: {
          description: "key to verify token against",
          private: true,
          type: "blob"
        },
      }),
      Interceptor.configurationAttributes
    );
  }

  async receive(endpoint, next, ctx, ...args) {
    const token = tokenFromAuthorizationHeader(ctx.req.header);
    if (token) {
      const decoded = await verifyPromisified(token, this.key);
      // ctx.state[tokenKey] = decoded;

      return await next(ctx, ...args);
    } else {
      ctx.throw(401);
    }
  }
}

function tokenFromAuthorizationHeader(header) {
  if (header.authorization) {
    const parts = header.authorization.split(" ");

    if (parts.length === 2) {
      const [scheme, credentials] = parts;
      if (/^Bearer$/i.test(scheme)) {
        return credentials;
      }
    }
  }
}
