/* jslint node: true, esnext: true */
"use strict";

const http = require('http'),
  https = require('https'),
  Koa = require('kronos-koa'),
  Service = require('kronos-service').Service;

// The under the configuration is registered
const DEFAULT_PORT = 9898;

/**
 * Start the HTTP server
 * @param name A name for this services
 * @param values The configuration for this koa service
 */
class ServiceKOA extends Service {

  static get type() {
    return "koa";
  }
  get type() {
    return ServiceKOA.type;
  }

  constructor(config) {
    super(config);

    this.koa = new Koa();

    const props = {
      port: {
        value: config.port ||  DEFAULT_PORT
      },
    };

    Object.defineProperties(this, props);
  }

  get url() {
    return `http://localhost:${port}`;
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
              fullfill(this);
            }
          });
        } catch (e) {
          this.error(e);
        }
      });
    }

    return Promise.resolve(this);
  }

  _stop() {
    if (this.koa.hasMiddleware() || !this.server) return Promise.resolve(this);

    return new Promise((fulfill, reject) => {
      // no more middleware registered. Stop the http server
      this.info("Stopping http server");

      this.server.close(err => {
        if (err) {
          reject(err);
        } else {
          this.server = undefined;
          fulfill(this);
        }
      });
    });
  }

}

module.exports.ServiceKOA = ServiceKOA;

module.exports.registerWithManager = function (manager) {
  manager.serviceRegister(ServiceKOA);
};
