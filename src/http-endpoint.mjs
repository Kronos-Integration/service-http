import { compile } from "multi-path-matcher";
import { SendEndpoint } from "@kronos-integration/endpoint";

/**
 * Endpoint to link against a http route
 */
export class HTTPEndpoint extends SendEndpoint {
  /**
   * @param {string} name endpoint name
   * @param {Object} owner owner of the endpoint
   * @param {Object} options
   * @param {string} options.path url path defaults to endpoint name
   * @param {string} options.method http methos defaults to GET
   */
  constructor(name, owner, options = {}) {
    super(name, owner, options);

    if (options.path !== undefined) {
      Object.defineProperty(this, "path", {
        value: options.path
      });
    }

    if (options.method !== undefined) {
      const method = options.method.toUpperCase();

      if (method !== "GET") {
        Object.defineProperty(this, "method", {
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

  get toStringAttributes() {
    return { ...super.toStringAttributes, method: "method", path: "path" };
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
  const routingEndpoints = compile(
    [...Object.values(ks.endpoints)].filter(e => e instanceof HTTPEndpoint)
  );

  return async (ctx, next) => {
    for (const route of routingEndpoints) {
      const m = ctx.path.match(route.regex);
      if (m && route.method === ctx.method) {
        try {
          await route.receive(ctx, m.groups);
        } catch (e) {
          ks.error({
            method: ctx.method,
            path: ctx.path,
            error: e
          });
          ctx.body = e;
          ctx.status = 500;
        }

        return next();
      }
    }
  };
}
