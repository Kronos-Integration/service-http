import test from "ava";
import got from "got";

import { ReceiveEndpoint } from "@kronos-integration/endpoint";
import {
  StandaloneServiceProvider,
  InitializationContext
} from "@kronos-integration/service";
import {
  ServiceHTTP,
  HTTPEndpoint,
  CTXInterceptor,
  CTXBodyParamInterceptor
} from "@kronos-integration/service-http";

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
  r1.receive = async params => {
    return `OK R1 ${params.key}`;
  };

  const s1 = ks.addEndpoint(
    new HTTPEndpoint("/s1/:key", ks, {
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
    if (body.error) {
      throw "this is an error";
    }
    return { ...body, message: "OK R2" };
  };

  await ks.start();

  let response = await got("http://localhost:1240/s1/abc");
  t.is(response.body, "OK R1 abc");
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

  response = await got("http://localhost:1240/s2", {
    form: { prop1: "value1", prop2: 2 },
    method: "POST"
  });
  t.deepEqual(JSON.parse(response.body), {
    prop1: "value1",
    prop2: "2",
    message: "OK R2"
  });
  t.is(response.statusCode, 200);

  try {
    response = await got("http://localhost:1240/s2", {
      form: { error: true },
      method: "POST"
    });
  } catch (e) {
    t.is(e.message, "Response code 500 (Internal Server Error)");
  }

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
      "/s3": { method: "PATCH" },
      "/s4": { path: "/somwhere" },
      "/s4b": { path: "/somwhere" },
      "DELETE:/resource": { },
      "/resource": {},
      "PUT:/resource": { }
    }
  });

  t.is(http.endpoints["/s1"].name, "/s1");
  t.is(http.endpoints["/s1"].path, "/s1");
  t.is(http.endpoints["/s1"].method, "GET");
  t.true(http.endpoints["/s1"] instanceof HTTPEndpoint);

  t.is(http.endpoints["/s2"].method, "POST");
  t.is(http.endpoints["/s3"].method, "PATCH");
  t.is(http.endpoints["/s4"].path, "/somwhere");
  t.is(http.endpoints["/s4b"].path, "/somwhere");

  t.is(http.endpoints["/resource"].path, "/resource");
  t.is(http.endpoints["/resource"].method, "GET");

  t.is(http.endpoints["DELETE:/resource"].path, "/resource");
  t.is(http.endpoints["DELETE:/resource"].method, "DELETE");

  t.is(http.endpoints["PUT:/resource"].path, "/resource");
  t.is(http.endpoints["PUT:/resource"].method, "PUT");

  await http.start();

  let response = await got("http://localhost:1241/s1");
  t.is(response.body, "OK R1");
  t.is(response.statusCode, 200);


  await http.stop();
});
