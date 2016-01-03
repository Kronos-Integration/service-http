/* jslint node: true, esnext: true */
"use strict";

const http = require('http'),
  https = require('https'),
  Koa = require('kronos-koa'),
  service = require('kronos-service');

// The under the configuration is registered
const DEFAULT_PORT = 9898;

function createService(name, values) {
  if (!values) values = {};

  values.koa = new Koa();
  if (!values.port) values.port = DEFAULT_PORT;

  values._start = function () {
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
  };

  values._stop = function () {
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
  };

  return service.createService(name, values);
}

module.exports.registerWithManager = function (manager) {
  manager.serviceRegister(createService('koa', {}));
};
