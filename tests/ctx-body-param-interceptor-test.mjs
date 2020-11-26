import test from "ava";
import { TestContext } from "./helpers/context.mjs";
import { SendEndpoint } from "@kronos-integration/endpoint";
import { StandaloneServiceProvider } from "@kronos-integration/service";
import {
  ServiceHTTP,
  CTXBodyParamInterceptor
} from "@kronos-integration/service-http";

test("CTXBodyParamInterceptor application/json", async t => {
  const sp = new StandaloneServiceProvider();
  const http = await sp.declareService({
    type: ServiceHTTP
  });
  const endpoint = new SendEndpoint("e", http);

  const interceptor = new CTXBodyParamInterceptor();

  const ctx = new TestContext({
    body: "{}",
    headers: {
      "Content-Type": "application/json"
    }
  });

  await interceptor.receive(endpoint, (ctx, a, b, c) => {}, ctx, 1, 2, 3);

  t.is(ctx.code, 200);
  // t.is(ctx.headers["Cache-Control"], "no-store, no-cache, must-revalidate");
});
