import { compile } from "multi-path-matcher";
import { SendEndpoint } from "@kronos-integration/endpoint";

/**
 * @typedef CTX {Object}
 * @property {http.ServerResponse} res
 * @property {http.ServerRequest} req
 */

/**
 * Endpoint to link against a http route.
 *
 * @param {string} name endpoint name
 * @param {Object} owner owner of the endpoint
 * @param {Object} options
 * @param {string} options.path url path defaults to endpoint name
 * @param {string} options.method http method defaults to GET
 */
export class HTTPEndpoint extends SendEndpoint {
  constructor(name, owner, options = {}) {
    super(name, owner, options);
    
    const m = name.match(/^(?<method>\w+):(?<path>.*)/);

    let { method, path } = m ? m.groups : options;

    if (path !== undefined) {
      Object.defineProperty(this, "path", {
        value: path
      });
    }

    if (method !== undefined) {
      method = method.toUpperCase();

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

/**
 * 
 * @param {HTTPServer} httpService
 * @return {RequestListener}
 */
export function endpointRouter(httpService) {
  const routingEndpoints = compile(
    Object.values(httpService.endpoints).filter(e => e instanceof HTTPEndpoint)
  );

  return async (req, res) => {
    let statusCode = 500;

    const ctx = {
      req,
      res,
      is: mime => req.headers["content-type"] === mime,
      throw(code, message) {
        statusCode = code;
        throw new Error(message);
      }
    };

    const method = req.method;
    const path = req.url;

    for (const route of routingEndpoints) {
      const m = path.match(route.regex);

      if (m && route.method === method) {
        try {
          const params = Object.fromEntries(
            route.keys.map((k, i) => [k, m[i + 1]])
          );
          await route.send(ctx, params);
        } catch (e) {
          httpService.error({
            method,
            path,
            error: e
          });

          res.writeHead(statusCode, { "content-type": "text/plain" });
          res.end(e.message);
        }

        return;
      }
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end();
  };
}
