import test from "ava";
import { TestContext } from "./helpers/context.mjs";
import { SendEndpoint } from "@kronos-integration/endpoint";
import { StandaloneServiceProvider } from "@kronos-integration/service";
import {
  ServiceHTTP,
  CTXBodyParamInterceptor
} from "@kronos-integration/service-http";

test("CTXBodyParamInterceptor text/html", async t => {
  const sp = new StandaloneServiceProvider();
  const http = await sp.declareService({
    type: ServiceHTTP
  });
  const endpoint = new SendEndpoint("e", http);
  const interceptor = new CTXBodyParamInterceptor();

  const ctx = new TestContext({
    headers: {
      "Content-Type": "text/html"
    }
  });

  await interceptor.receive(endpoint, () => {}, ctx);

  t.is(ctx.code, 415);
});

test("CTXBodyParamInterceptor application/json", async t => {
  const sp = new StandaloneServiceProvider();
  const http = await sp.declareService({
    type: ServiceHTTP
  });
  const endpoint = new SendEndpoint("e", http);
  const interceptor = new CTXBodyParamInterceptor();

  const deliverdContent = { a: 1 };
  const ctx = new TestContext({
    body: JSON.stringify(deliverdContent),
    headers: {
      "Content-Type": "application/json"
    }
  });

  await interceptor.receive(
    endpoint,
    (content, params) => {
      t.deepEqual(content, deliverdContent);
      t.deepEqual(params, { k: "v" });
    },
    ctx,
    { k: "v" }
  );

  t.is(ctx.code, 200);
});

test("CTXBodyParamInterceptor application/x-www-form-urlencoded", async t => {
  const sp = new StandaloneServiceProvider();
  const http = await sp.declareService({
    type: ServiceHTTP
  });
  const endpoint = new SendEndpoint("e", http);
  const interceptor = new CTXBodyParamInterceptor();

  const deliverdContent = { a: "1" };
  const ctx = new TestContext({
    body: new URLSearchParams(deliverdContent).toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });

  await interceptor.receive(
    endpoint,
    (content, params) => {
      t.deepEqual(content, deliverdContent);
      t.deepEqual(params, { k: "v" });
    },
    ctx,
    { k: "v" }
  );

  t.is(ctx.code, 200);
});
