import { compile } from "multi-path-matcher";
import { SendEndpoint } from "@kronos-integration/endpoint";

/**
 * @typedef CTX {Object}
 * @property {http.ServerResponse} res
 * @property {http.ServerRequest} req
 * @property {Function} is
 * @property {Function} throw
 */

/**
 * Endpoint to link against a http route.
 *
 * The endpoint name may be in the form of '<METHOD>:<path>'.
 * Then <METHOD> will be used as http method
 * and <path> as the url path component.
 * @param {string} name endpoint name
 * @param {Object} owner owner of the endpoint
 * @param {Object} options
 * @param {string} options.path url path component defaults to endpoint name
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
    let statusCode;

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
          await route.send(
            ctx,
            Object.fromEntries(route.keys.map((k, i) => [k, m[i + 1]]))
          );
        } catch (error) {
          httpService.error({
            method,
            path,
            error
          });

          res.writeHead(statusCode || 500, TEXT_PLAIN);
          res.end(error.message);
        }

        return;
      }
    }

    res.writeHead(404, TEXT_PLAIN);
    res.end();
  };
}

const TEXT_PLAIN = { "content-type": "text/plain" };
