import { mergeAttributes, createAttributes } from "model-attributes";
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

  static get configurationAttributes() {
    return mergeAttributes(
      createAttributes({
        headers: {
          description: "http headers",
          default: {},
          setter(value) {
            this.headers = { ...value };
          }
        }
      }),
      Interceptor.configurationAttributes
    );
  }

  headers = {};

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
