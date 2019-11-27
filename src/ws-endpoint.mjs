import WebSocket from "ws";
import { compile } from "multi-path-matcher";
import { SendEndpoint } from "@kronos-integration/endpoint";


import bufferutil from "bufferutil";
import utf8Validate from "utf-8-validate";


/**
 * Endpoint to link against a websocket route
 */
export class WSEndpoint extends SendEndpoint {
  /**
   * @param {string} name endpoint name
   * @param {Object} owner owner of the endpoint
   * @param {Object} options
   * @param {string} options.path url path defaults to endpoint name
   */
  constructor(name, owner, options = {}) {
    super(name, owner, options);

    if (options.path !== undefined) {
      Object.defineProperty(this, "path", {
        value: options.path
      });
    }
  }

  get path() {
    return this.name;
  }

  get ws() {
    return true;
  }

  get toStringAttributes() {
    return { ...super.toStringAttributes, ws: "ws", path: "path" };
  }

  get jsonAttributes() {
    return [...super.jsonAttributes, "path", "ws"];
  }
}

export function initializeWS(service) {
  const wsEndpoints = compile(
    [...Object.values(service.endpoints)].filter(e => e instanceof WSEndpoint)
  );

  service.wss = new WebSocket.Server({ server: service.server });
  service.wss.on("connection", (ws, req) => {
    const path = req.url;
    console.log("connection", req.url);

    for (const endpoint of wsEndpoints) {
      if (path.match(endpoint.regex)) {
        console.log("FOUND", endpoint.path);
        //    endpoint.request()
      }
    }

    ws.on("message", message => {
      console.log("received: %s", message);
    });

    ws.send("from server");
    ws.close();
  });
}
