import { WebSocketServer } from "ws";
import { compile } from "multi-path-matcher";
import { SendReceiveEndpoint } from "@kronos-integration/endpoint";
import { Service } from "@kronos-integration/service";

import bufferutil from "bufferutil";
import utf8Validate from "utf-8-validate";

import { verifyJWT } from "./util.mjs";

/**
 * Endpoint to link against a websocket route.
 * @param {string} name endpoint name
 * @param {Object} owner owner of the endpoint
 * @param {Object} options
 * @param {string} options.path url path defaults to endpoint name
 *
 * @property {Set<WebSocket>} sockets
 */
export class WSEndpoint extends SendReceiveEndpoint {
  sockets = new Set();
  #path;

  constructor(name, owner, options) {
    super(name, owner, options);

    if (options?.path !== undefined) {
      this.#path = options.path;
    }
  }

  closeSockets() {
    this.sockets.forEach(ws => ws.terminate());
  }

  addSocket(ws, request) {
    const owner = this.owner;

    owner.info(`${ws.readyState} ${request.url} <> ${this}`);

    this.sockets.add(ws);

    for (const other of this.connections()) {
      owner.trace(`${this} open ${other}`);
      this.openConnection(other);
    }

    ws.on("error", error => owner.error(`${this} error ${error}`));
    ws.on("open", () => owner.trace(`${this} open`));

    ws.on("close", (code, reason) => {
      owner.trace(`${this} close ${code} ${reason}`);
      this.sockets.delete(ws);
      if (!this.isOpen) {
        for (const other of this.connections()) {
          owner.trace(`${this} close ${other}`);

          this.closeConnection(other);
        }
      }
    });

    ws.on("message", async message => {
      const response = await this.send(message);
      ws.send(response);
    });
  }

  get isOpen() {
    return this.sockets.size > 0;
  }

  async receive(arg) {
    this.owner.trace(`${this}: send ${JSON.stringify(arg)}`);

    const interceptors = this.receivingInterceptors;
    let c = 0;

    const next = async arg => {
      if (c >= interceptors.length) {
        for (const socket of this.sockets) {
          socket.send(arg);
        }
      } else {
        return interceptors[c++].receive(this, next, arg);
      }
    };

    return next(arg);
  }

  get path() {
    return this.#path || this.name;
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

/**
 * Check sec-websocket-protocol header for presence of
 * 'access_token' and the token.
 * Throws if no valid token is present.
 * @param {Service} service
 * @param {*} request
 */
async function authenticate(service, request) {
  const protocol = request.headers["sec-websocket-protocol"];

  if (protocol) {
    const protocols = protocol.split(/\s*,\s*/);

    const ia = protocols.indexOf("access_token");
    if (ia >= 0) {
      const token = protocols[ia + 1];
      await verifyJWT(token, service.jwt.public);
      return;
    }
  }

  throw new Error("Invalid access_token in sec-websocket-protocol");
}

export function initializeWS(service) {
  const wsEndpoints = compile(
    Object.values(service.endpoints).filter(e => e instanceof WSEndpoint)
  );

  const server = service.server;

  const wss = new WebSocketServer({ server });
  service.wss = wss;

  wss.on("error", error => service.error(error));

  wss.on("connection", (ws, request) => {
    const path = request.url;
    for (const endpoint of wsEndpoints) {
      if (path.match(endpoint.regex)) {
        endpoint.addSocket(ws, request);
      }
    }
  });

  server.on("upgrade", async (request, socket, head) => {
    try {
      await authenticate(service, request);
    } catch (err) {
      service.error(err);
      socket.destroy();
    }
  });
}

export function closeWS(service) {
  Object.values(service.endpoints)
    .filter(e => e instanceof WSEndpoint)
    .forEach(e => e.closeSockets());
}
