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

  get jsonAttributes() {
    return [...super.jsonAttributes, "method", "path"];
  }
}

export function endpointRouter(httpService) {
  const routingEndpoints = compile(
    Object.values(httpService.endpoints).filter(e => e instanceof HTTPEndpoint)
  );

  return async (req, res) => {
    const ctx = {
      req,
      res,
      is(mime) {
        return true;
      },
      throw(code) {
        throw new Error(code);
      }
    };

    const method = req.method;
    const path = req.url;

    for (const route of routingEndpoints) {
      const m = path.match(route.regex);

      if (m && route.method === method) {
        try {
          await route.send(ctx, m.groups);
        } catch (e) {
          httpService.error({
            method,
            path,
            error: e
          });

          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end(e.message);
        }

        return;
      }
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end();
  };
}
