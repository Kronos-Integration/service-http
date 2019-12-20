import jwt from "jsonwebtoken";
import { promisify } from "util";

import { Interceptor } from "@kronos-integration/interceptor";
import { mergeAttributes, createAttributes } from "model-attributes";

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
        }
      }),
      Interceptor.configurationAttributes
    );
  }

  async receive(endpoint, next, ctx, ...args) {
    const token = tokenFromAuthorizationHeader(ctx.req.headers);
    if (token) {
      try {
        const decoded = await verifyPromisified(token, this.key);
        // ctx.state[tokenKey] = decoded;
      } catch (e) {
        ctx.res.writeHead(401, { "Content-Type": "text/plain" });
        ctx.res.end(e.message);
        return;
      }

      return await next(ctx, ...args);
    } else {
      ctx.res.writeHead(401, { "Content-Type": "text/plain" });
      ctx.res.end("missing token");
    }
  }
}

function tokenFromAuthorizationHeader(headers) {
  if (headers.authorization) {
    const parts = headers.authorization.split(" ");

    if (parts.length === 2) {
      const [scheme, credentials] = parts;
      if (/^Bearer$/i.test(scheme)) {
        return credentials;
      }
    }
  }
}
