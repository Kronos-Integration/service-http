import { CTXInterceptor } from "./ctx-interceptor.mjs";
import { APPLICATION_JSON, TEXT_PLAIN } from "./constants.mjs";

/**
 * Extracts params from request body.
 * Supported content types are:
 * - application/json
 * - application/x-www-form-urlencoded
 */
export class CTXBodyParamInterceptor extends CTXInterceptor {
  /**
   * @return {string} 'ctx-body-param'
   */
  static get name() {
    return "ctx-body-param";
  }

  async receive(endpoint, next, ctx, ...args) {
    const sendResponse = response => {
      if (typeof response === "string") {
        ctx.res.writeHead(200, {
          ...this.headers,
          ...TEXT_PLAIN
        });
        ctx.res.end(response);
      } else {
        ctx.res.writeHead(200, {
          ...this.headers,
          ...APPLICATION_JSON
        });
        ctx.res.end(JSON.stringify(response));
      }
    };

    if (ctx.is("application/x-www-form-urlencoded")) {
      const chunks = [];
      for await (const chunk of ctx.req) {
        chunks.push(chunk);
      }

      sendResponse(await next(Object.fromEntries(
        new URLSearchParams(chunks.join("")).entries()
      ), ...args));
    } else if (ctx.is("application/json")) {
      const chunks = [];
      for await (const chunk of ctx.req) {
        chunks.push(chunk);
      }

      sendResponse(await next(JSON.parse(chunks.join("")), ...args));
    } else {
      ctx.throw(415, `Unsupported content type ${ctx.req.headers["content-type"]}`);
    }
  }
}
