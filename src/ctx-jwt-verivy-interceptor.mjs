import { Interceptor } from "@kronos-integration/interceptor";
import jwt from "jsonwebtoken";
import { promisify } from "util";

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

  async receive(ctx, params) {
    const token = tokenFromAuthorizationHeader(ctx.header);
    if (token) {
      const decoded = await verifyPromisified(token, "xxx");
      // ctx.state[tokenKey] = decoded;

      return await this.connected.receive(ctx, params);
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
