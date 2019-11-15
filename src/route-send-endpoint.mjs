import { SendEndpoint } from "@kronos-integration/endpoint";

/**
 * Endpoint to link against a koa route
 */
export class RouteSendEndpoint extends SendEndpoint {
  /**
   * @param name {string} endpoint name
   * @param owner {Step} the owner of the endpoint
   * @param method {string} http method defaults to get
   */
  constructor(name, owner, path, method) {
    super(name, owner);

    Object.defineProperties(this, {
      path: {
        value: path
      },
      method: {
        value: method ? method.toUpperCase() : "GET"
      }
    });
  }

  get socket() {
    return false;
  }

  route() {
    return async (ctx, next) => {
      if (!this.matches(ctx)) return next();

      try {
        const values = {};
        await this.receive(ctx, values);
        ctx.body = "OK-AFTER-RECEIVE";
      } catch (e) {
        this.owner.error({
          method: this.method,
          path: this.path,
          error: e
        });
        ctx.body = e;
        ctx.status = 500;
      }
      // miss
      //return next();
    };
  }

  matches(ctx) {
    if (ctx.method === this.method) return true;
    if (this.method === "GET" && ctx.method === "HEAD") return true;
    return false;
  }

  toString() {
    return `${this.method} ${this.name}`;
  }

  toJSON() {
    const json = super.toJSON();

    for (const attr of ["method", "path"]) {
      if (this[attr] !== undefined) {
        json[attr] = this[attr];
      }
    }

    return json;
  }
}
