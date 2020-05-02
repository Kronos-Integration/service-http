import test from "ava";
import { TestContext } from "./helpers/context.mjs";
import { SendEndpoint } from "@kronos-integration/endpoint";
import { StandaloneServiceProvider } from "@kronos-integration/service";
import { ServiceHTTP, CTXInterceptor } from "@kronos-integration/service-http";

test("defaults", async t => {
  const interceptor = new CTXInterceptor();
  t.deepEqual(interceptor.headers, {});
});

test("default headers", async t => {
  const sp = new StandaloneServiceProvider();
  const http = await sp.declareService({
    type: ServiceHTTP
  });
  const endpoint = new SendEndpoint("e", http);

  const configuredHeaders = {
    "Cache-Control": "no-store, no-cache, must-revalidate"
  };

  const interceptor = new CTXInterceptor({
    headers: configuredHeaders
  });

  t.deepEqual(interceptor.headers, configuredHeaders);

  const ctx = new TestContext();

  await interceptor.receive(endpoint, (ctx, a, b, c) => {}, ctx, 1, 2, 3);

  t.is(ctx.code, 200);
  t.is(ctx.headers["Cache-Control"], "no-store, no-cache, must-revalidate");
});
