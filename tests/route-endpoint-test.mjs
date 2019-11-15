import test from "ava";
import got from "got";

import { SendEndpoint } from "@kronos-integration/endpoint";
import { StandaloneServiceProvider } from "@kronos-integration/service";
import { ServiceKOA } from "../src/service-koa.mjs";
import { RouteSendEndpoint, endpointRouter } from "../src/route-send-endpoint.mjs";

test("endpoint route basics", async t => {
  const sp = new StandaloneServiceProvider();
  const ks = new ServiceKOA(
    {
      listen: {
        socket: 1239
      }
    },
    sp
  );

  const r1 = ks.addEndpoint(new RouteSendEndpoint("/r1", ks));
  const s1 = new SendEndpoint("s1");
  s1.receive = async () => "OK S1";
  r1.connected = s1;

  const r2 = ks.addEndpoint(new RouteSendEndpoint("/r2", ks));
  const s2 = new SendEndpoint("s2");
  s2.receive = async () => "OK S2";
  r2.connected = s2;

  ks.koa.use(endpointRouter(ks));

  await ks.start();

  let response = await got("http://localhost:1239/r1");
  t.is(response.body, "OK S1");
  t.is(response.statusCode, 200);

  response = await got("http://localhost:1239/r2");
  t.is(response.body, "OK S2");
  t.is(response.statusCode, 200);

  //response = await got("http://localhost:1239/r0");

  await ks.stop();
});

test("endpoint factory", async t => {
  const sp = new StandaloneServiceProvider();

  const http = await sp.declareService({
    name: 'http',
    type: ServiceKOA,
    listen: {
      socket: 1239
    },
    endpoints: {
      '/r1': {},
      '/r2': { method: 'post' },
      '/r3': { path: '/somwhere' }
    }
  }, true);


  t.is(http.endpoints['/r1'].name, '/r1');
  t.is(http.endpoints['/r1'].path, '/r1');
  t.is(http.endpoints['/r1'].method, 'GET');
  t.true(http.endpoints['/r1'] instanceof RouteSendEndpoint);

  t.is(http.endpoints['/r2'].method, 'POST');
  t.is(http.endpoints['/r3'].path, '/somwhere');

});
