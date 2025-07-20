import { prepareAttributesDefinitions } from "pacc";
import { Interceptor } from "@kronos-integration/interceptor";
import { APPLICATION_JSON, TEXT_PLAIN } from "./constants.mjs";

/**
 * Basic interceptor providing/consuming http request/response.
 */
export class CTXInterceptor extends Interceptor {
  /**
   * @return {string} 'ctx'
   */
  static get name() {
    return "ctx";
  }

  static attributes = prepareAttributesDefinitions({
    headers: {
      description: "http headers",
      default: {},
      set(value) {
        this.headers = { ...value };
      }
    },
    ...Interceptor.attributes
  });

  //headers = {};

  async receive(endpoint, next, ctx, params) {
    const result = await next(params);

    switch (typeof result) {
      case "string":
        ctx.res.writeHead(200, {
          ...this.headers,
          ...TEXT_PLAIN
        });
        ctx.res.end(result);
        break;

      //case 'object':
      default:
        ctx.res.writeHead(200, {
          ...this.headers,
          ...APPLICATION_JSON
        });
        ctx.res.end(JSON.stringify(result));
        break;
    }
  }
}
