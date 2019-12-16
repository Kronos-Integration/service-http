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

  sockets = new Set();

  constructor(name, owner, options = {}) {
    super(name, owner, options);

    if (options.path !== undefined) {
      Object.defineProperty(this, "path", {
        value: options.path
      });
    }
  }

  closeSockets() {
    this.sockets.forEach(ws => ws.terminate());
  }

  addSocket(ws, request) {
    const owner = this.owner;

    owner.info(`${ws.readyState} ${request.url} <> ${this}`);

    this.sockets.add(ws);

    ws.on("error", error => owner.error(`${this} error ${error}`));
    ws.on("open", () => {
      for (const other of this.connections()) {
        this.openConnection(other);
        owner.trace(`${this} open ${other}`);
      }
    });

    ws.on("close", (code, reason) => {
      owner.trace(`${this} close ${code} ${reason}`);
      this.sockets.delete(ws);
      if (!this.isOpen) {
        for (const other of this.connections()) {
          this.closeConnection(other);
          owner.trace(`${this} close ${other}`);
        }
      }
    });

    ws.on("message", async message => {
      const response = await this.send(message);
      ws.send(response);
    });
  }

  get isOpen() {
    return true;
    //    return this.sockets.size > 0;
  }

  async receive(arg) {
    this.owner.trace(`${this}: send ${arg}`);
    for (const socket of this.sockets) {
      socket.send(arg);
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
    Object.values(service.endpoints).filter(e => e instanceof WSEndpoint)
  );

  service.wss = new WebSocket.Server({ server: service.server });

  service.wss.on("error", error => service.error(error));

  service.wss.on("connection", (ws, request) => {
    const path = request.url;
    service.trace({ message: `connection ${path}`, url: path });

    for (const endpoint of wsEndpoints) {
      if (path.match(endpoint.regex)) {
        endpoint.addSocket(ws, request);
      }
    }
  });
}

export function closeWS(service) {
  Object.values(service.endpoints).filter(
    e => e instanceof WSEndpoint
  ).forEach(e => e.closeSockets());
}
