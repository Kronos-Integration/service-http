/* jslint node: true, esnext: true */
'use strict';

const http = require('http'),
  https = require('https'),
  url = require('url'),
  pathToRegexp = require('path-to-regexp'),
  mat = require('model-attributes'),
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

  static get configurationAttributes() {
    return Object.assign(mat.createAttributes({
      docRoot: {
        description: 'file system root for static content',
        type: 'fs-path'
      },
      listen: {
        description: 'server listen definition',

        attributes: {
          retryTimeout: {
            description: 'how long should we retry binding to the address (EADDRINUSE)',
            default: 10,
            type: 'duration'
          },
          address: {
            description: 'hostname/ip-address of the http(s) server',
            needsRestart: true,
            type: 'string'
          },
          fromPort: {
            description: 'start port range of the http(s) server',
            type: 'integer'
          },
          toPort: {
            description: 'end port range of the http(s) server',
            type: 'integer'
          },
          port: {
            description: 'port of the http(s) server',
            needsRestart: true,
            default: 9898,
            type: 'integer'
          }
        }
      },
      key: {
        description: 'ssl key',
        needsRestart: true
      },
      cert: {
        description: 'ssl cert',
        needsRestart: true
      },
      timeout: {
        description: 'server timeout',
        type: 'duration',
        default: 120,
        setter(value) {
          if (value && this.server) {
            this.server.setTimeout(value * 1000);
            return true;
          }
          return false;
        }
      }
    }), Service.configurationAttributes);
  }

  constructor(config, owner) {
    super(config, owner);

    this.socketEndpoints = {};
    this.koa = new Koa();

    if (this.docRoot) {
      this.koa.use(require('koa-static')(this.docRoot), {});
    }
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
    return `${this.scheme}://${this.address}:${this.port}`;
  }

  get port() {
    return this.listen.port;
  }

  get address() {
    return this.listen.address;
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

  timeoutForTransition(transition) {
    if (transition.name === 'start') {
      if (this.listen && this.listen.retryTimeout)
        return this.listen.retryTimeout * 1000;
    }

    return super.timeoutForTransition(transition);
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
          ws.on('message', (message, flags) => {
            try {
              message = JSON.parse(message);
              this.trace({
                endpoint: ep.toString(),
                received: message
              });
              ep.receive(message);
            } catch (e) {
              this.error(e);
            }
          });
          ws.on('close', () => ep.close(ws));
        }
      });

      if (this.timeout) {
        this.server.setTimeout(this.timeout * 1000);
      }

      return new Promise((fullfill, reject) => {
        this.trace(level => `starting ${this.url}`);

        const service = this;
        const server = this.server;

        if (service.listen.fromPort) {
          service.listen.port = service.listen.fromPort;
        }

        function listen() {
          const handler = err => {
            process.removeListener('uncaughtException', addressInUseHandler);
            if (err) {
              service.server = undefined;
              service.error(err);
              reject(err);
            } else {
              service.trace(level => `listening on ${service.url}`);
              fullfill();
            }
          };

          if (service.listen.address) {
            server.listen(service.listen.port, service.listen.address, handler);
          } else {
            server.listen(service.listen.port, handler);
          }
        }

        function addressInUseHandler(e) {
          if (e.code === 'EADDRINUSE') {
            service.trace(level => `Address in use ${service.url} retrying...`);

            // try different strategies
            // 1. retry later
            // 2. use other port / interface

            if (service.listen.fromPort && service.listen.port < service.listen.toPort) {
              service.listen.port++;
              listen();
              return;
            }

            setTimeout(() => {
              server.close();
              listen();
            }, 10000);
          }
        }

        process.on('uncaughtException', addressInUseHandler);
        //server.on('error', addressInUseHandler);
        listen();
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
          this.owner.error({
            method: this.method,
            path: this.path,
            error: e
          });
          ctx.body = e;
          ctx.status = 500;
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
    super(name, owner, {
      createOpposite: true
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
    this.owner.trace({
      state: 'open',
      endpoint: this.identifier
    });
    this.opposite.receive = message => {
      return new Promise((fullfill, reject) => {
        this.owner.trace({
          message: 'send',
          endpoint: this.identifier,
          content: message
        });
        ws.send(JSON.stringify(message),
          error => {
            if (error) {
              reject(error);
            } else {
              fullfill();
            }
          });
      });
    };
  }

  close(ws) {
    this.owner.trace({
      state: 'close',
      endpoint: this.identifier
    });
    this.opposite.receive = undefined;
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
