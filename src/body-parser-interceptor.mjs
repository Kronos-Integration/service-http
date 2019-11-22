import { Interceptor } from "@kronos-integration/interceptor";

/**
 * extracts params form request body
 */
export class BodyParserInterceptor extends Interceptor {
  async receive(ctx, params) {
    if (ctx.is("application/json")) {
      const chunks = [];
      for await(const chunk of ctx.req) {
        chunks.push(chunk);
      }
      return await this.connected.receive(JSON.parse(chunks.join('')));
    }

    ctx.throw(415, "no json");
  }
}
