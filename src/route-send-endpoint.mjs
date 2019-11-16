import { compile, matcher } from "multi-path-matcher";
import { SendEndpoint } from "@kronos-integration/endpoint";

/**
 * Endpoint to link against a http route
 */
export class RouteSendEndpoint extends SendEndpoint {
  /**
   * @param {string} name  endpoint name
   * @param {Object} owner owner of the endpoint
   * @param {Object} options 
   * @param {string} options.path
   * @param {string} options.method
   */
  constructor(name, owner, options={}) {
    super(name, owner);

    if (options.path !== undefined) {
      Object.defineProperty(this, 'path', {
        value: options.path
      });
    }

    if (options.method !== undefined) {
      const method = options.method.toUpperCase();

      if (method !== 'GET') {
        Object.defineProperty(this, 'method', {
          value: method
        });
      }
    }
  }

  get method() {
    return "GET";
  }

  get path() {
    return this.name;
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
