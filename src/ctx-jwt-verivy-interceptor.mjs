import { verifyJWT } from "./util.mjs";
import { Interceptor } from "@kronos-integration/interceptor";

/**
 * Only forward requests if a valid JWT token is present.
 */
export class CTXJWTVerifyInterceptor extends Interceptor {
  /**
   * @return {string} 'ctx-jwt-verify'
   */
  static get name() {
    return "ctx-jwt-verify";
  }

  async receive(endpoint, next, ctx, ...args) {
    const token = tokenFromAuthorizationHeader(ctx.req.headers);
    if (token) {
      try {
        const key = endpoint.owner.jwt.public;
        /*const decoded =*/ await verifyJWT(token, key);
        // ctx.state[tokenKey] = decoded;
      } catch (error) {
        reportError(ctx, error);
        return;
      }

      return await next(ctx, ...args);
    } else {
      reportError(ctx);
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

/**
 * Write WWW-Authenticate header
 *
 * @param {*} ctx
 * @param {*} error
 * @param {*} description
 */
function reportError(ctx, error, description) {

  const entries = Object.entries({
    error: error ? error.message : "missing token",
    description
  }).filter(([name,value])=> value !== undefined);

  ctx.res.writeHead(401, {
    "WWW-Authenticate":
      "Bearer," +
      entries
        .map(([name, value]) => `${name}="${value}"`)
        .join(","),
    "Content-Type": "text/plain"
  });

  ctx.res.end(entries
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n"));
}
