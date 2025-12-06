import { CTXInterceptor } from "./ctx-interceptor.mjs";
import { APPLICATION_JSON, TEXT_PLAIN } from "./constants.mjs";

const _typeDecoders = {
  "application/x-www-form-urlencoded": async ctx =>
    Object.fromEntries(
      new URLSearchParams((await Array.fromAsync(ctx.req)).join("")).entries()
    ),
  "application/json": async ctx =>
    JSON.parse((await Array.fromAsync(ctx.req)).join(""))
};

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

  typeDecoders = _typeDecoders;

  async receive(endpoint, next, ctx, ...args) {
    for (const [type, decoder] of Object.entries(this.typeDecoders)) {
      if (ctx.is(type)) {
        const response = await next(await decoder(ctx), ...args);

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
        return;
      }
    }

    ctx.throw(
      415,
      `Unsupported content type ${
        ctx.req.headers["content-type"]
      } [${Object.keys(this.typeDecoders)}]`
    );
  }
}
