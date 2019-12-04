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
    //this.ws = ws;

    this.sockets.add(ws);

    ws.on("message", async message => {
      const response = await this.send(message);
      ws.send(response);
    });
  }

  async receive(...args) {
/*
    this.ws.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(...args);
      }
    });
*/
    
    for (const socket of this.sockets) {
      socket.send(...args);
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
  service.wss.on("connection", (ws, request, client) => {
    const path = request.url;
    service.trace({ message: `connection ${path} ${client}`, url: path });

    for (const endpoint of wsEndpoints) {
      if (path.match(endpoint.regex)) {
        console.log("FOUND", endpoint.toJSON());
        endpoint.addSocket(ws);
      }
    }
  });
}
