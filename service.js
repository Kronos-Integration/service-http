/* jslint node: true, esnext: true */
"use strict";

const http = require('http'),
  https = require('https'),
  Koa = require('kronos-koa'),
  Service = require('kronos-service').Service;

const DEFAULT_PORT = 9898;

/**
 * HTTP server
 */
class ServiceKOA extends Service {

  static get name() {
    return "koa";
  }

  get type() {
    return ServiceKOA.name;
  }

  constructor(config, owner) {
    super(config, owner);

    this.koa = new Koa();

    const props = {
      port: {
        get() {
          return config.port || DEFAULT_PORT;
        }
      },
      key: {
        get() {
          return config.key;
        }
      },
      cert: {
        get() {
          return config.cert;
        }
      }
    };

    Object.defineProperties(this, props);
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
    return this.isSecure ? 'https' : 'http';
  }

  get url() {
    return `${this.scheme}://localhost:${this.port}`;
  }

  /**
   * apply new configuration.
   * if required restarts the server
   */
  configure(config) {
    let needsRestart = false;

    if (this.port !== config.port) {
      this.config.port = config.port;
      needsRestart = true;
    }

    return needsRestart ? this.restartIfRunning() : Promise.resolve();
  }

  _start() {
    if (!this.server) {
      if (this.isSecure) {
        this.server = https.createServer(this.serverOptions, this.koa.callback());
      } else {
        this.server = http.createServer(this.koa.callback());
      }

      return new Promise((fullfill, reject) => {
        this.info(level => `Starting ${this.scheme} server on port ${this.port}`);

        try {
          this.server.listen(this.port, err => {
            if (err) {
              this.server = undefined;
              reject(err);
            } else {
              fullfill();
            }
          });
        } catch (e) {
          this.error(e);
        }
      });
    }

    return Promise.resolve();
  }

  _stop() {
    return new Promise((fulfill, reject) => {
      this.info("Stopping http server");

      this.server.close(err => {
        if (err) {
          reject(err);
        } else {
          this.server = undefined;
          fulfill();
        }
      });
    });
  }
}

module.exports.Service = ServiceKOA;

module.exports.registerWithManager = manager => manager.registerServiceFactory(ServiceKOA);
