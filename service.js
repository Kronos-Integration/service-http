/* jslint node: true, esnext: true */
'use strict';

const http = require('http'),
  https = require('https'),
  address = require('network-address'),
  url = require('url'),
  Koa = require('kronos-koa'),
  WebSocketServer = require('ws').Server,
  Service = require('kronos-service').Service,
  endpoint = require('kronos-endpoint'),
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
 * HTTP server with koa
 */
class ServiceKOA extends Service {

  static get name() {
    return 'koa';
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

    const ws = new ReceiveEndpoint('ws');
    ws.receive = request => {
      this.trace(level => `broadcast ${JSON.stringify(request.data)} to ws`);

      this.wss.clients.forEach(client => {
        client.send(request.data);
      });

      return Promise.resolve();
    };

    this.addEndpoint(ws);
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

  _configure(config) {
    super._configure(config);

    if (this.socketEndpoints === undefined) {
      this.socketEndpoints = {};
    }

    if (config.sockets) {
      Object.keys(config.sockets).forEach(name => {
        const s = config.sockets[name];
        this.createSocketEndpoint(name, s.path);
        this.info(`socket: ${name} ${s.path}`);
      });
    }
  }

  /**
   * apply new configuration.
   * if required restarts the server
   */
  configure(config) {
    const sp = super.configure(config);
    let needsRestart = false;

    if (config.timeout && this.server) {
      this.server.setTimeout(config.timeout);
    }

    Object.keys(configAttributes).forEach(name => {
      if (config[name] !== undefined && this[name] !== config[name]) {
        needsRestart |= configAttributes[name].needsRestart;
        this.config[name] = config[name];
      }
    });

    return needsRestart ? sp.then(p => this.restartIfRunning()) : sp;
  }

  createSocketEndpoint(name, path) {
    const ep = this.addEndpoint(new SocketEndpoint(name, this));
    this.socketEndpoints[path || name] = ep;
    return ep;
  }

  endpointForSocketConnection(ws) {
    const location = url.parse(ws.upgradeReq.url, true);
    this.info(`connection: ${location.path} -> ${this.socketEndpoints[location.path]}`);
    return this.socketEndpoints[location.path];
    // you might use location.query.access_token to authenticate or share sessions
    // or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)
  }

  _start() {
    if (!this.server) {
      if (this.isSecure) {
        this.server = https.createServer(this.serverOptions, this.koa.callback());
      } else {
        this.server = http.createServer(this.koa.callback());
      }

      this.wss = new WebSocketServer({
        server: this.server
      });

      this.wss.on('connection', ws => {
        const ep = this.endpointForSocketConnection(ws);

        if (ep) {
          ws.on('message', message => ep.receive(message));
        }

        const id = setInterval(() => {
          ws.send(JSON.stringify({
            memory: process.memoryUsage()
          }), () => { /* ignore errors */ });
        }, 1000);
        ws.on('close', () => {
          //console.log('stopping client interval');
          clearInterval(id);
        });
      });

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

class SocketEndpoint extends endpoint.SendEndpoint {

}

module.exports.Service = ServiceKOA;
module.exports.registerWithManager = manager => manager.registerServiceFactory(ServiceKOA);
