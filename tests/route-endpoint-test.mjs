import test from "ava";
import got from "got";

import { StandaloneServiceProvider } from "@kronos-integration/service";
import { ServiceKOA } from "../src/service-koa.mjs";
import { RouteSendEndpoint } from "../src/route-send-endpoint.mjs";

test("endpoint route", async t => {
  const sp = new StandaloneServiceProvider();
  const ks = new ServiceKOA(
    {
      listen : {
        socket: 1239
      }
    },
    sp
  );

  const r1 = new RouteSendEndpoint("r1", ks, "/test1");

  r1.connected = ks.endpoints.config;

  ks.koa.use(r1.route());

  await ks.start();

  const response = await got("http://localhost:1239/test1");
  t.is(response.body, "OK-AFTER-RECEIVE");
  t.is(response.statusCode, 200);

  await ks.stop();
});
