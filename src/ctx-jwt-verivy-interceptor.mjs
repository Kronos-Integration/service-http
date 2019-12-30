import { verifyJWT } from './util.mjs';
import { Interceptor } from "@kronos-integration/interceptor";


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

  async receive(endpoint, next, ctx, ...args) {
    const token = tokenFromAuthorizationHeader(ctx.req.headers);
    if (token) {
      try {
        const key = endpoint.owner.jwt.public;
        /*ctx.jwt =*/ await verifyJWT(token, key);
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

function reportError(ctx, error) {
  const description = error ? error.message : "missing token";

  ctx.res.writeHead(401, { 
    "WWW-Authenticate": `Bearer,error_description=${description}`,
    /*
                    error="invalid_token",
*/
    "Content-Type": "text/plain" });

    ctx.res.end(description);
}
