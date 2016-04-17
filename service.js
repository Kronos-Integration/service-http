/* jslint node: true, esnext: true */
'use strict';

const http = require('http'),
  https = require('https'),
  address = require('network-address'),
  url = require('url'),
  pathToRegexp = require('path-to-regexp'),
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

    this.socketEndpoints = {};
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
      ep = this.addSocketEndpoint(new SocketEndpoint(name, this));
    }
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

        if (ep && ep.connected) {
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


module.exports.Service = ServiceKOA;
module.exports.registerWithManager = manager => manager.registerServiceFactory(ServiceKOA);



function decode(val) {
  if (val) return decodeURIComponent(val);
}

/**
 * Endpoint to link against a koa route
 */
class RouteSendEndpoint extends endpoint.SendEndpoint {

  /**
   * @param name {String} endpoint name
   * @param owner {Step} the owner of the endpoint
   * @param method {String} http method defaults to get
   * @param serviceName {String} if present registers the route as a service
   */
  constructor(name, owner, path, method, serviceName) {
    super(name, owner);

    // The path in the URL
    Object.defineProperty(this, 'path', {
      value: path
    });

    const keys = [];
    const re = pathToRegexp(path, keys, {});

    Object.defineProperty(this, 'regex', {
      value: re
    });

    Object.defineProperty(this, 'keys', {
      value: keys
    });

    method = method ? method.toUpperCase() : 'GET';

    // The HTTP method to use (GET, POST, ...)
    Object.defineProperty(this, 'method', {
      value: method
    });

    Object.defineProperty(this, 'serviceName', {
      value: serviceName
    });
  }

  get socket() {
    return false;
  }

  get route() {
    return (ctx, next) => {
      if (!this.matches(ctx, this.method)) return next();

      // path
      const m = this.regex.exec(ctx.path);
      if (m) {
        const args = m.slice(1).map(decode);
        const values = {};
        const keys = this.keys;
        for (const i in args) {
          values[keys[i].name] = args[i];
        }

        return this.receive(ctx, values).catch(e => {
          this.owner.error(`${this.method} ${this.path}: ${e}`);
          ctx.body = e;
        });
      }

      // miss
      return next();
    };
  }

  matches(ctx) {
    if (ctx.method === this.method) return true;
    if (this.method === 'GET' && ctx.method === 'HEAD') return true;
    return false;
  }

  toString() {
    return `${this.method} ${this.name}`;
  }

  toJSON() {
    const json = super.toJSON();

    for (const attr of['serviceName', 'method', 'path']) {
      if (this[attr] !== undefined) {
        json[attr] = this[attr];
      }
    }

    return json;
  }
}

module.exports.RouteSendEndpoint = RouteSendEndpoint;

class SocketEndpoint extends endpoint.SendEndpoint {
  constructor(name, owner, path) {
    super(name, owner);

    // The path in the URL
    Object.defineProperty(this, 'path', {
      value: path
    });
  }

  get socket() {
    return true;
  }
}

module.exports.SocketEndpoint = SocketEndpoint;
