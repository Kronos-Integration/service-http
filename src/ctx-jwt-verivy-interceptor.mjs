import { Interceptor } from "@kronos-integration/interceptor";
import {
  prepareAttributesDefinitions,
  string_collection_attribute_writable
} from "pacc";
import { verifyJWT } from "./util.mjs";
import { TEXT_PLAIN } from "./constants.mjs";

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

  static attributes = prepareAttributesDefinitions({
    requiredEntitlements: {
      ...string_collection_attribute_writable,
      description: "entitlements to be present in the token",
      prepareValue: value => new Set(value),
      default: new Set()
    },
    ...Interceptor.attributes
  });

  async receive(endpoint, next, ctx, ...args) {
    const token = tokenFromAuthorizationHeader(ctx.req.headers);
    if (token) {
      try {
        const key = endpoint.owner.jwt?.public;
        const decoded = await verifyJWT(token, key);

        if (
          !this.requiredEntitlements.isSubsetOf(new Set(decoded.entitlements))
        ) {
          reportError(
            ctx,
            403,
            new Error("Insufficient entitlements", {
              cause: decoded.entitlements
            })
          );
          return;
        }
      } catch (error) {
        reportError(ctx, 401, error);
        return;
      }

      return await next(ctx, ...args);
    } else {
      reportError(ctx, 401);
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
 * Write WWW-Authenticate header.
 *
 * @param {*} ctx
 * @param {number} error code
 * @param {Error} [error]
 * @param {string} [description]
 */
function reportError(ctx, code, error, description) {
  const entries = Object.entries({
    error: error?.message || "Missing token",
    description
  }).filter(([name, value]) => value !== undefined);

  ctx.res.writeHead(code, {
    "WWW-Authenticate":
      "Bearer," +
      entries.map(([name, value]) => `${name}="${value}"`).join(","),
    ...TEXT_PLAIN
  });

  ctx.res.end(entries.map(([name, value]) => `${name}: ${value}`).join("\n"));
}
