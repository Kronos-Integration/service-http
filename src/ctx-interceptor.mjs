import { mergeAttributes, createAttributes } from "model-attributes";
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

  async receive(endpoint, next, ctx, params) {
    const result = await next(params);

    switch (typeof result) {
      case "string":
        ctx.res.writeHead(200, {
          ...this.headers,
          "Content-Type": "text"
        });
        ctx.res.end(result);
        break;

      //case 'object':
      default:
        ctx.res.writeHead(200, {
          ...this.headers,
          "Content-Type": "application/json"
        });
        ctx.res.end(JSON.stringify(result));
        break;
    }
  }
}
