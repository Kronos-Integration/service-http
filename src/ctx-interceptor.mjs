import { Interceptor } from "@kronos-integration/interceptor";

/**
 * extracts params form request body
 */
export class CTXInterceptor extends Interceptor {

  /**
   * @return {string} 'ctx-body-param'
   */
  static get name() {
    return 'ctx';
  }

  async receive(ctx, params) {
    ctx.body = await this.connected.receive(params);
  }
}
