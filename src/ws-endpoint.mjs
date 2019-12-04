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

    const properties = {
      sockets: { value: new Set() }
    };

    if (options.path !== undefined) {
      properties.path = {
        value: options.path
      };
    }

    Object.defineProperties(this, properties);
  }

  addSocket(ws) {
    this.sockets.add(ws);
  }

  async receive(...args) {
    for (const s of this.sockets) {
      s.send(...args);
    }
  }

  get isIn() {
    true;
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
    service.trace({ message: `connection ${path}`, url: path });

    for (const endpoint of wsEndpoints) {
      if (path.match(endpoint.regex)) {
        console.log("FOUND", endpoint.toJSON());

        endpoint.addSocket(ws);

        ws.on("message", async message => {
          console.log("received: %s", message);
          const response = await endpoint.send(message);
          ws.send(response);
        });
      }
    }
  });
}
