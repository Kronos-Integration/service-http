import test from "ava";
import WebSocket from "ws";
import { SendEndpoint } from "@kronos-integration/endpoint";
import { StandaloneServiceProvider } from "@kronos-integration/service";
import { ServiceKOA, RouteSendEndpoint } from "../src/service-koa.mjs";


test.skip("ws send", async t => {
  const sp = new StandaloneServiceProvider();

  const s1 = new SendEndpoint("s1");
  s1.receive = message => {
    console.log(`se: ${message}`);
    s1.opposite.receive(message);
    return "OK S1";
  };

  const http = await sp.declareService(
    {
      name: "http",
      type: ServiceKOA,
      listen: {
        socket: 1236
      },
      endpoints: {
        "/r1": { connected: s1, ws: true }
      }
    }
  );

  t.is(http.endpoints["/r1"].name, "/r1");
  t.is(http.endpoints["/r1"].path, "/r1");
  t.is(s1.ws, true);
  t.is(http.endpoints["/r1"].method, "GET");
  t.true(http.endpoints["/r1"] instanceof RouteSendEndpoint);

  await http.start();

  const socketUrl = "ws://localhost:1236/r1";
  const ws = new WebSocket(socketUrl, {});

  ws.on("open", () =>
    ws.send(Date.now().toString(), {
      mask: true
    })
  );

  ws.on("close", () => {
    console.log("disconnected");
  });

});
