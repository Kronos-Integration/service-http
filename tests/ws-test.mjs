import test from "ava";
import WebSocket from "ws";
import { SendEndpoint } from "@kronos-integration/endpoint";
import { StandaloneServiceProvider } from "@kronos-integration/service";
import { ServiceKOA } from "../src/service-koa.mjs";
import { WSEndpoint } from "../src/ws-endpoint.mjs";

async function wait(msecs = 1000) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), msecs);
  });
}

test("ws send", async t => {
  const sp = new StandaloneServiceProvider();

  let sererOppositeOpened = 0;

  const s1 = new SendEndpoint("s1", {
    opposite: { opened: () => { console.log("opened"); } },

    opened: endpoint => {
      sererOppositeOpened++;
      const o = endpoint.opposite;
      endpoint.receive(o.receive());

      const interval = setInterval(
        () => endpoint.receive(o.receive()),
        1000
      );

      return () => clearInterval(interval);
    },

    receive: message => {
     // console.log(message);
      return "OK S1";
    }
  });

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
  t.is(http.endpoints["/r1"].ws, true);
  t.true(http.endpoints["/r1"] instanceof WSEndpoint);

  await http.start();

  const socketUrl = "ws://localhost:1236/r1";
  const ws = new WebSocket(socketUrl, {});


  let disconnected = 0;
  let opened = 0;

  ws.on("open", () => {
    opened++;

    ws.send("form client", {
      mask: true
    });
  }
  );

  ws.on("message", message => {
    console.log("from server:", message);
  });

  ws.on("close", () => {
    disconnected++;
  });

  await wait(2000);

  t.is(opened, 1);
 // t.is(sererOppositeOpened, 1);

  
  //t.is(disconnected, 1);
});
