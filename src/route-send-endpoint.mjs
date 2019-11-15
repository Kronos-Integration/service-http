import { compile, matcher } from "multi-path-matcher";
import { SendEndpoint } from "@kronos-integration/endpoint";

/**
 * Endpoint to link against a koa route
 */
export class RouteSendEndpoint extends SendEndpoint {
  /**
   * @param name {string} endpoint name
   * @param owner {Step} the owner of the endpoint
   * @param method {string} http method defaults to get
   */
  constructor(name, owner, path, method) {
    super(name, owner);

    Object.defineProperties(this, {
      path: {
        value: path
      },
      method: {
        value: method ? method.toUpperCase() : "GET"
      }
    });
  }

  get socket() {
    return false;
  }

  toString() {
    return `${this.method} ${this.path}`;
  }

  toJSON() {
    const json = super.toJSON();

    for (const attr of ["method", "path"]) {
      if (this[attr] !== undefined) {
        json[attr] = this[attr];
      }
    }

    return json;
  }
}

export function endpointRouter(ks) {
  let routingEndpoints = [...Object.values(ks.endpoints)].filter(
    e => e instanceof RouteSendEndpoint
  );

  routingEndpoints = compile(routingEndpoints);

  return async (ctx, next) => {
    const { route, params } = matcher(routingEndpoints, ctx.path);

    if (route && ctx.method === route.method) {
      try {
        ctx.body = await route.receive(ctx, params);
      } catch (e) {
        ks.error({
          method: route.method,
          path: route.path,
          error: e
        });
        ctx.body = e;
        ctx.status = 500;
      }
    }
    return next();
  };
}
