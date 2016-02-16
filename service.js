/* jslint node: true, esnext: true */
"use strict";

const http = require('http'),
  https = require('https'),
  address = require('network-address'),
  Koa = require('kronos-koa'),
  IO = require('koa-socket'),
  Service = require('kronos-service').Service,
  ReceiveEndpoint = require('kronos-endpoint').ReceiveEndpoint;

const configAttributes = {
  port: {
    needsRestart: true,
    default: 9898
  },
  hostname: {
    needsRestart: true,
    default: address()
  },
  key: {
    needsRestart: true
  },
  cert: {
    needsRestart: true
  },
  timeout: {
    default: 120000
  },
  io: {
    needsRestart: true
  }
};

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

    const props = {};

    Object.keys(configAttributes).forEach(name =>
      props[name] = {
        get() {
          return config[name] || configAttributes[name].default;
        }
      });

    Object.defineProperties(this, props);

    const io = new ReceiveEndpoint('io');
    io.receive = request => {
      if (this.koa.io) {
        this.koa.io.broadcast(request.event, request.data);
      }
      return Promise.resolve();
    };

    this.addEndpoint(io);
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
    return `${this.scheme}://${this.hostname}:${this.port}`;
  }

  /**
   * apply new configuration.
   * if required restarts the server
   */
  configure(config) {
    let needsRestart = false;

    if (config.timeout) {
      this.server.setTimeout(config.timeout);
    }

    Object.keys(configAttributes).forEach(name => {
      if (config[name] !== undefined && this[name] !== config[name]) {
        needsRestart |= configAttributes[name].needsRestart;
        this.config[name] = config[name];
      }
    });

    if (config.io) {
      const io = new IO();
      io.attach(this.koa);
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

      if (this.timeout) {
        this.server.setTimeout(this.timeout);
      }

      return new Promise((fullfill, reject) => {
        this.trace(level => `starting ${this.url}`);

        try {
          this.server.listen(this.port, this.hostname, err => {
            if (err) {
              this.server = undefined;
              reject(err);
            } else {
              fullfill();
            }
          });
        } catch (e) {
          this.error(e);
          reject(e);
        }
      });
    }

    return Promise.resolve();
  }

  _stop() {
    return new Promise((fulfill, reject) => {
      this.trace(level => `stopping ${this.url}`);

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
