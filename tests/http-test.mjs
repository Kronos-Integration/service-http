import test from "ava";
import got from "got";

import { ReceiveEndpoint } from "@kronos-integration/endpoint";
import {
  StandaloneServiceProvider,
  InitializationContext
} from "@kronos-integration/service";
import { ServiceHTTP } from "../src/service-http.mjs";
import { HTTPEndpoint } from "../src/http-endpoint.mjs";
import { CTXInterceptor } from "../src/ctx-interceptor.mjs";
import { CTXBodyParamInterceptor } from "../src/ctx-body-param-interceptor.mjs";

test("endpoint route basics", async t => {
  const sp = new StandaloneServiceProvider();
  const ic = new InitializationContext(sp);

  const ks = new ServiceHTTP(
    {
      listen: {
        socket: 1240
      }
    },
    ic
  );

  const r1 = new ReceiveEndpoint("r1", sp);
  r1.receive = async () => "OK R1";

  const s1 = ks.addEndpoint(
    new HTTPEndpoint("/s1", ks, {
      interceptors: [CTXInterceptor],
      connected: r1
    })
  );

  const r2 = new ReceiveEndpoint("s2", sp);

  const s2 = ks.addEndpoint(
    new HTTPEndpoint("/s2", ks, {
      method: "POST",
      interceptors: [CTXBodyParamInterceptor],
      connected: r2
    })
  );

  t.truthy(s2.hasInterceptors);

  r2.receive = async body => {
    return { ...body, message: "OK R2" };
  };

  await ks.start();

  let response = await got("http://localhost:1240/s1");
  t.is(response.body, "OK R1");
  t.is(response.statusCode, 200);

  response = await got("http://localhost:1240/s2", {
    json: { prop1: "value1", prop2: 2 },
    method: "POST"
  });
  t.deepEqual(JSON.parse(response.body), {
    prop1: "value1",
    prop2: 2,
    message: "OK R2"
  });
  t.is(response.statusCode, 200);

  await ks.stop();
});

test("endpoint factory", async t => {
  const sp = new StandaloneServiceProvider();

  const r1 = new ReceiveEndpoint("r1", sp);
  r1.receive = async () => "OK R1";

  const http = await sp.declareService({
    type: ServiceHTTP,
    listen: {
      socket: 1241
    },
    endpoints: {
      "/s1": { connected: r1, interceptors: [CTXInterceptor] },
      "/s2": { method: "post" },
      "/s3": { path: "/somwhere" }
    }
  });

  t.is(http.endpoints["/s1"].name, "/s1");
  t.is(http.endpoints["/s1"].path, "/s1");
  t.is(http.endpoints["/s1"].method, "GET");
  t.true(http.endpoints["/s1"] instanceof HTTPEndpoint);

  t.is(http.endpoints["/s2"].method, "POST");
  t.is(http.endpoints["/s3"].path, "/somwhere");

  await http.start();

  let response = await got("http://localhost:1241/s1");
  t.is(response.body, "OK R1");
  t.is(response.statusCode, 200);
});
