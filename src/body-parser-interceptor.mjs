import { Interceptor } from "@kronos-integration/interceptor";

/**
 * extracts params form request body
 */
export class BodyParserInterceptor extends Interceptor {
  async receive(ctx, params) {
    console.log("BodyParserInterceptor");
    return await this.connected.receive(params);
  }
}
