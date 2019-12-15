import { Interceptor } from "@kronos-integration/interceptor";

/**
 * extracts params form request body
 */
export class CTXInterceptor extends Interceptor {
  /**
   * @return {string} 'ctx-body-param'
   */
  static get name() {
    return "ctx";
  }

  async receive(endpoint, next, ctx, params) {

    const result = await next(params);

    switch(typeof result) {
      case 'string':
        ctx.res.writeHead(200, { "Content-Type": "text" });
        ctx.res.end(result);
      break;
      
      //case 'object':
      default:
        ctx.res.writeHead(200, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify(result));
      break;
    }
  }
}
