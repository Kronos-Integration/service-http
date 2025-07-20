import { createServer as httpCreateServer } from "node:http";
import { createServer as httpsCreateServer } from "node:https";
import { prepareAttributesDefinitions, mergeAttributeDefinitions } from "pacc";
import { Service } from "@kronos-integration/service";
import { HTTPEndpoint, endpointRouter } from "./http-endpoint.mjs";
import { WSEndpoint, initializeWS, closeWS } from "./ws-endpoint.mjs";
export { CTXInterceptor } from "./ctx-interceptor.mjs";
export { CTXBodyParamInterceptor } from "./ctx-body-param-interceptor.mjs";
export { CTXJWTVerifyInterceptor } from "./ctx-jwt-verivy-interceptor.mjs";

export { HTTPEndpoint, WSEndpoint };

/**
 * HTTP server.
 * @property {http.Server} server only present if state is running
 */
export class ServiceHTTP extends Service {
  /**
   * @return {string} 'http'
   */
  static get name() {
    return "http";
  }

  static get description() {
    return "http server";
  }

  static attributes = mergeAttributeDefinitions(
    prepareAttributesDefinitions({
      jwt: {
        description: "jwt related",
        attributes: {
          public: {
            description: "public key to check token against",
            mandatory: true,
            private: true,
            type: "blob"
          }
        }
      },
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
            set(value, attribute) {
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
    }),
    Service.attributes
  );

  /**
   * @return {string} name with url
   */
  get extendetName() {
    return `${this.name}(${this.url})`;
  }

  /**
   * On demand create RouteSendEndpoint´s.
   * @param {string} name
   * @param {Object|string} definition
   * @return {Class} RouteSendEndpoint if path is present of name starts with '/'
   */
  endpointFactoryFromConfig(name, definition, ic) {
    if (definition.ws) {
      return WSEndpoint;
    }

    if (
      definition.method ||
      definition.path ||
      name[0] === "/" ||
      name.match(/^\w+:\//)
    ) {
      return HTTPEndpoint;
    }

    return super.endpointFactoryFromConfig(name, definition, ic);
  }

  /**
   * Should we make a secure connection.
   *
   * @return {boolean} true if key is present
   */
  get isSecure() {
    return this.key !== undefined;
  }

  /**
   * Options passed to @see {http.createServer} or @see {https.createServer}.
   *
   * @return {Object}
   */
  get serverOptions() {
    return {
      key: this.key,
      cert: this.cert
    };
  }

  get scheme() {
    return this.isSecure ? "https" : "http";
  }

  get url() {
    const listen = this.listen;

    if (listen) {
      const socket = this.socket;
      const url = listen.url;

      if (url) {
        if (Number.isInteger(socket)) {
          const u = new URL(url);
          u.port = socket;
          return u.toString().replace(/\/$/, "");
        }

        return url;
      }

      if (socket !== undefined) {
        return Number.isInteger(socket)
          ? `${this.scheme}://${this.address}:${socket}`
          : `fd:///${socket.fd}`;
      }
    }
  }

  get socket() {
    const listen = this.listen;

    if (listen) {
      const socket = listen.socket;
      if (socket) {
        return socket;
      }
      const url = listen.url;
      if (url) {
        const u = new URL(url);
        return Number(u.port);
      }
    }
  }

  get address() {
    const listen = this.listen;

    if (listen) {
      const address = listen.address;
      if (address) {
        return address;
      }
      const url = listen.url;
      if (url) {
        const u = new URL(url);
        return u.hostname;
      }

      return "localhost";
    }
  }

  async _start() {
    await super._start();

    try {
      const server = (this.server = (
        this.isSecure ? httpsCreateServer : httpCreateServer
      )(this.serverOptions, endpointRouter(this)));

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
            this.trace(
              `Listening on ${this.url} (${JSON.stringify(this.socket)})`
            );
            resolve();
          }
        };

        server.on("error", listenHandler);

        try {
          server.listen(
            ...[this.socket, this.address, listenHandler].filter(x => x)
          );
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
    return super._stop();
  }
}

export default ServiceHTTP;
