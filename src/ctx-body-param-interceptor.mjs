import { Interceptor } from "@kronos-integration/interceptor";

/**
 * extracts params form request body
 */
export class CTXBodyParamInterceptor extends Interceptor {
  /**
   * @return {string} 'ctx-body-param'
   */
  static get name() {
    return "ctx-body-param";
  }

  async receive(endpoint, next, ctx, params) {
    if (ctx.is("application/json")) {
      const chunks = [];
      for await (const chunk of ctx.req) {
        chunks.push(chunk);
      }
      ctx.res.writeHead(200, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify(await next(JSON.parse(chunks.join("")))));
    } else {
      ctx.throw(415, "no json");
    }
  }
}
