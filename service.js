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

  constructor(config) {
    super(config);

    this.koa = new Koa();

    const props = {
      port: {
        get() {
          return config.port || DEFAULT_PORT;
        }
      },
    };

    Object.defineProperties(this, props);
  }

  get url() {
    return `http://localhost:${this.port}`;
  }

  /**
   * use new configuration
   */
  configure(config) {
    if (this.port !== config.port) {
      this.config.port = config.port;
      return this.restartIfRunning();
    }

    return Promise.resolve();
  }

  _start() {
    if (!this.server) {
      this.server = http.createServer(this.koa.callback());

      return new Promise((fullfill, reject) => {
        this.info(level => `Starting http server on port ${this.port}`);

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
