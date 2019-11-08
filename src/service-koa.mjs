import http from "http";
import https from "https";
import Koa from "koa";
import { mergeAttributes, createAttributes } from "model-attributes";
import { Service } from "@kronos-integration/service";
import { RouteSendEndpoint } from "./route-send-endpoint.mjs";
import { SocketEndpoint } from "./socket-endpoint.mjs";

export { RouteSendEndpoint, SocketEndpoint };

/**
 * HTTP server with koa
 * @property {http.Server} server only present if state is running
 * @property {koa} koa
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
            address: {
              description: "hostname/ip-address of the http(s) server",
              needsRestart: true,
              type: "hostname"
            },
            socket: {
              description: "listening port|socket of the http(s) server",
              needsRestart: true,
              type: "listen-socket"
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
    return `${this.scheme}://${this.address}:${this.socket}`;
  }

  get socket() {
    return this.listen.socket;
  }

  get address() {
    return this.listen.address;
  }

  async _start() {
    try {
      this.server = this.isSecure
        ? https.createServer(this.serverOptions, this.koa.callback())
        : http.createServer(this.koa.callback());

      const server = this.server;

      if (this.timeout !== undefined) {
        server.setTimeout(this.timeout * 1000);
      }

      return new Promise((resolve, reject) => {
        this.trace(`starting ${this.url}`);

        const handler = err => {
          if (err) {
            delete this.server;
            this.error(err);
            reject(err);
          } else {
            this.trace(`listening on ${this.url}`);
            resolve();
          }
        };

        server.on('error', handler);

        try {
          if (this.listen.address === undefined) {
            server.listen(this.listen.socket, handler);
          } else {
            server.listen(
              this.listen.socket,
              this.listen.address,
              handler
            );
          }
        } catch (err) {
          delete this.server;
          this.error(err);
          reject(err);
        }

      });
    } catch (e) {
      delete this.server;
      throw e;
    }
  }

  _stop() {
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.trace(`stopping ${this.url}`);
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
}

export default ServiceKOA;
