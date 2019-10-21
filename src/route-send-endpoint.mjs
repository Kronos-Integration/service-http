import { SendEndpoint } from 'kronos-endpoint';

/**
 * Endpoint to link against a koa route
 */
export class RouteSendEndpoint extends SendEndpoint {
  /**
   * @param name {string} endpoint name
   * @param owner {Step} the owner of the endpoint
   * @param method {string} http method defaults to get
   * @param serviceName {string} if present registers the route as a service
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

    for (const attr of ['serviceName', 'method', 'path']) {
      if (this[attr] !== undefined) {
        json[attr] = this[attr];
      }
    }

    return json;
  }
}
