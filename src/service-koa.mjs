import http from "http";
import https from "https";
import url from "url";
import Koa from "koa";
import { mergeAttributes, createAttributes } from "model-attributes";
import { Service } from "@kronos-integration/service";
import { RouteSendEndpoint } from "./route-send-endpoint.mjs";
import { SocketEndpoint } from "./socket-endpoint.mjs";

export { RouteSendEndpoint, SocketEndpoint };

/**
 * HTTP server with koa
 */
export class ServiceKOA extends Service {
  /**
   * @return {string} 'koa'
   */
  static get name() {
    return "koa";
  }

  static get configurationAttributes() {
    return mergeAttributes(
      Service.configurationAttributes,
      createAttributes({
        auth: {
          description: "authentification",
          attributes: {
            jwt: {
              description: "json web tokens",
              attributes: {
                privateKey: {
                  description: "private key content"
                }
              }
            }
          }
        },

        listen: {
          description: "server listen definition",

          attributes: {
            retryTimeout: {
              description:
                "how long should we retry binding to the address (EADDRINUSE)",
              default: 10,
              type: "duration"
            },
            address: {
              description: "hostname/ip-address of the http(s) server",
              needsRestart: true,
              type: "hostname"
            },
            fromPort: {
              description: "start port range of the http(s) server",
              type: "ip-port"
            },
            toPort: {
              description: "end port range of the http(s) server",
              type: "ip-port"
            },
            port: {
              description: "port of the http(s) server",
              needsRestart: true,
              default: 9898,
              type: "ip-port"
            }
          }
        },
        key: {
          description: "ssl key",
          needsRestart: true,
          type: "blob"
        },
        cert: {
          description: "ssl cert",
          needsRestart: true,
          type: "blob"
        },
        timeout: {
          attributes: {
            server: {
              description: "server timeout",
              type: "duration",
              default: 120,
              setter(value, attribute) {
                if (value === undefined) {
                  value = attribute.default;
                }

                if (this.timeout === undefined) {
                  this.timeout = {};
                }

                this.timeout.server = value;

                if (this.server) {
                  this.server.setTimeout(value * 1000);
                  return true;
                }
                return false;
              }
            }
          }
        }
      })
    );
  }

  constructor(config, owner) {
    super(config, owner);

    Object.defineProperties(this, {
      socketEndpoints: { value: {} },
      koa: { value: new Koa() }
    });

    /*
    if (this.auth) {
      if (this.auth.jwt) {
        this.koa.use(jwt({
          secret: '',
          algorithm: 'RS256'
        }));
      }
    }
    */
  }

  get isSecure() {
    return this.key !== undefined;
  }

  get serverOptions() {
    if (this.isSecure) {
      return {
        key: this.key,
        cert: this.cert
      };
    }

    return undefined;
  }

  get scheme() {
    return this.isSecure ? "https" : "http";
  }

  get url() {
    return `${this.scheme}://${this.address}:${this.port}`;
  }

  get port() {
    return this.listen.port;
  }

  get address() {
    return this.listen.address;
  }

  addSocketEndpoint(ep) {
    //this.addEndpoint(new SocketEndpoint(name, this));
    this.socketEndpoints[ep.path] = ep;
    return ep;
  }

  removeSocketEndpoint(ep) {
    delete this.socketEndpoints[ep.path];
  }

  createSocketEndpoint(name, path) {
    const thePath = path || name;

    let ep = this.socketEndpoints[thePath];
    if (ep === undefined) {
      ep = this.addSocketEndpoint(new SocketEndpoint(name, this, path));
    }
    return ep;
  }

  endpointForSocketConnection(ws, req) {
    const location = url.parse(req.url, true);
    return this.socketEndpoints[location.path];
    // you might use location.query.access_token to authenticate or share sessions
    // or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)
  }

  async _start() {
    if (!this.server) {
      this.server = this.isSecure
        ? https.createServer(this.serverOptions, this.koa.callback())
        : http.createServer(this.koa.callback());

      /*
      this.wss = new WebSocketServer({
        server: this.server
      });

      this.wss.on("connection", (ws, req) => {
        const ep = this.endpointForSocketConnection(ws, req);

        if (ep) {
          ep.open(ws);
          ws.on("message", (message, flags) => {
            try {
              message = JSON.parse(message);
              this.trace({
                endpoint: ep.toString(),
                received: message
              });
              ep.receive(message);
            } catch (e) {
              this.error(e);
            }
          });
          ws.on("close", () => ep.close(ws));
        }
      });
*/

      if (this.timeout !== undefined) {
        this.server.setTimeout(this.timeout * 1000);
      }

      return new Promise((resolve, reject) => {
        this.trace(severity => `starting ${this.url}`);

        const service = this;
        const server = this.server;

        if (service.listen.fromPort !== undefined) {
          service.listen.port = service.listen.fromPort;
        }

        function listen() {

          const handler = err => {
            process.removeListener("uncaughtException", addressInUseHandler);
            if (err) {
              service.server = undefined;
              service.error(err);
              reject(err);
            } else {
              service.trace(severity => `listening on ${service.url}`);
              resolve();
            }
          };

          if (service.listen.address === undefined) {
            server.listen(service.listen.port, handler);
          } else {
            server.listen(service.listen.port, service.listen.address, handler);
          }
        }

        function addressInUseHandler(e) {
          if (e.code === "EADDRINUSE") {
            //console.log(`addressInUseHandler: ${e.code}`);

            service.trace(severity => `Address in use ${service.url} retrying...`);

            // try different strategies
            // 1. retry later
            // 2. use other port / interface

            if (
              service.listen.fromPort &&
              service.listen.port < service.listen.toPort
            ) {
              service.listen.port++;
              listen();
              return;
            }

            setTimeout(() => {
              server.close();
              listen();
            }, 10000);
          }
        }

        process.on("uncaughtException", addressInUseHandler);
        //server.on('error', addressInUseHandler);
        listen();
      });
    }
  }

  _stop() {
    return new Promise((resolve, reject) => {
      this.trace(severity => `stopping ${this.url}`);

      this.server.close(err => {
        if (err) {
          reject(err);
        } else {
          this.server = undefined;
          resolve();
        }
      });
    });
  }
}

function decode(val) {
  if (val !== undefined) return decodeURIComponent(val);
}

export default ServiceKOA;
