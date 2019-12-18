import http from "http";
import https from "https";
import { mergeAttributes, createAttributes } from "model-attributes";
import { Service } from "@kronos-integration/service";
import { HTTPEndpoint, endpointRouter } from "./http-endpoint.mjs";
import { WSEndpoint, initializeWS, closeWS } from "./ws-endpoint.mjs";
export { CTXInterceptor } from "./ctx-interceptor.mjs";
export { CTXBodyParamInterceptor } from "./ctx-body-param-interceptor.mjs";
export { CTXJWTVerifyInterceptor } from "./ctx-jwt-verivy-interceptor.mjs";

export { HTTPEndpoint, WSEndpoint };

/**
 * HTTP server
 * @property {http.Server} server only present if state is running
 */
export class ServiceHTTP extends Service {
  /**
   * @return {string} 'http'
   */
  static get name() {
    return "http";
  }

  static get configurationAttributes() {
    return mergeAttributes(
      Service.configurationAttributes,
      createAttributes({
        listen: {
          description: "server listen definition",

          attributes: {
            url: {
              description: "url of the http(s) server",
              needsRestart: true,
              type: "url"
            },
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
          private: true,
          type: "blob"
        },
        cert: {
          description: "ssl cert",
          needsRestart: true,
          private: true,
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

  /**
   * @return {string} name with url
   */
  get extendetName() {
    return `${this.name}(${this.url})`;
  }

  /**
   * on demand create RouteSendEndpoint´s
   * @param {string} name
   * @param {Object|string} definition
   * @return {Class} RouteSendEndpoint if path is present of name starts with '/'
   */
  endpointFactoryFromConfig(name, definition, ic) {
    if (definition.ws) {
      return WSEndpoint;
    }

    if (definition.method || definition.path || name[0] === "/") {
      return HTTPEndpoint;
    }

    return super.endpointFactoryFromConfig(name, definition, ic);
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
    const url = this.listen.url;

    const socket = this.socket;

    if (url) {
      if (Number.isInteger(this.listen.socket)) {
        const u = new URL(url);
        u.port = socket;
        return u.toString().replace(/\/$/, "");
      }

      return url;
    }

    if(socket === undefined) {
      return undefined;
    }
    
    return Number.isInteger(socket)
      ? `${this.scheme}://${this.address}:${socket}`
      : `fd:///${socket.fd}`;
  }

  get socket() {
    const socket = this.listen.socket;
    if (socket) {
      return socket;
    }
    const url = this.listen.url;
    if (url) {
      const u = new URL(url);
      return Number(u.port);
    }
  }

  get address() {
    const address = this.listen.address;
    if (address) {
      return address;
    }
    const url = this.listen.url;
    if (url) {
      const u = new URL(url);
      return u.hostname;
    }
  }

  async _start() {
    try {
      const server = (this.server = this.isSecure
        ? https.createServer(this.serverOptions, endpointRouter(this))
        : http.createServer(endpointRouter(this)));

      if (this.timeout !== undefined) {
        server.setTimeout(this.timeout * 1000);
      }

      await new Promise((resolve, reject) => {
        const listenHandler = err => {
          if (err) {
            delete this.server;
            this.error(err);
            reject(err);
          } else {
            this.trace(`listening on ${this.url} (${this.socket})`);
            resolve();
          }
        };

        server.on("error", listenHandler);

        try {
          if (this.listen.address === undefined) {
            server.listen(this.listen.socket, listenHandler);
          } else {
            server.listen(
              this.listen.socket,
              this.listen.address,
              listenHandler
            );
          }
        } catch (err) {
          delete this.server;
          this.error(err);
          reject(err);
        }
      });

      initializeWS(this);
    } catch (e) {
      delete this.server;
      throw e;
    }
  }

  async _stop() {
    if (this.server) {
      const openConnectionsInfoInterval = setInterval(
        () =>
          this.server.getConnections((err, count) =>
            this.info(`${this.fullName}: ${count} connection(s) still open`)
          ),
        2000
      );

      try {
        closeWS(this);

        await new Promise((resolve, reject) => {
          this.server.close(err => {
            if (err) {
              reject(err);
            } else {
              this.server = undefined;
              resolve();
            }
          });
        });
      } finally {
        clearInterval(openConnectionsInfoInterval);
      }
    }
  }
}

export default ServiceHTTP;
