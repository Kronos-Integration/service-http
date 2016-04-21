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

  get configurationAttributes() {
    return Object.assign({
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
        default: 120000,
        setter(value) {
          if (value && this.server) {
            this.server.setTimeout(value);
            return true;
          }
          return false;
        }
      }
    }, super.configurationAttributes);
  }

  constructor(config, owner) {
    super(config, owner);

    this.socketEndpoints = {};
    this.koa = new Koa();
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
      ep = this.addSocketEndpoint(new SocketEndpoint(name, this, path));
    }
    return ep;
  }

  endpointForSocketConnection(ws) {
    const location = url.parse(ws.upgradeReq.url, true);
    //this.info(`connection: ${location.path} -> ${this.socketEndpoints[location.path]}`);
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
          ep.open(ws);
          ws.on('message', message => {
            console.log(message);
            ep.receive(message);
          });
          ws.on('close', () => ep.close(ws));
        }
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

    const opposite = new endpoint.ReceiveEndpoint(this.name, this.owner);
    opposite.receive = message => Promise.reject(new Error(`${this.name}: socket closed`));

    Object.defineProperty(this, 'opposite', {
      value: opposite
    });

    Object.defineProperty(this, 'path', {
      value: path
    });
  }

  get socket() {
    return true;
  }

  matches(ws, url) {
    return url.path === this.path;
  }

  open(ws) {
    this.owner.info(`open ${this.name}`);
    this.opposite.receive = message => {
      return new Promise((fullfill, reject) =>
        ws.send(JSON.stringify(message),
          error => {
            if (error) {
              reject(error);
            } else {
              fullfill();
            }
          }));
    };
  }

  close(ws) {
    this.owner.info(`close ${this.name}`);
    this.opposite.receive = message => Promise.reject(new Error(`${this.name}: socket already closed`));
  }

  toJSON() {
    const json = super.toJSON();

    json.socket = true;

    for (const attr of['path']) {
      if (this[attr] !== undefined) {
        json[attr] = this[attr];
      }
    }

    return json;
  }
}

module.exports.SocketEndpoint = SocketEndpoint;
