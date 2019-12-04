import test from "ava";
import WebSocket from "ws";
import { ReceiveEndpoint } from "@kronos-integration/endpoint";
import { StandaloneServiceProvider } from "@kronos-integration/service";
import { ServiceKOA } from "../src/service-koa.mjs";
import { WSEndpoint } from "../src/ws-endpoint.mjs";

async function wait(msecs = 1000) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), msecs);
  });
}

const owner = {
  name: "owner"
};

function client() {
  const socketUrl = "ws://localhost:1236/w1";

  const ws = new WebSocket(socketUrl, {});

  const r = { messages: [], ws, disconnected: 0, opened:0 };

  ws.on("open", () => {
    r.opened++;

    ws.send("form client ", {
      mask: true
    });
  });


  ws.on("message", message => {
    console.log("from server", message);
    r.messages.push(message);
  });

  ws.on("close", () => {
    r.disconnected++;
  });
  
  return r;
}

test.skip("ws send", async t => {
  const sp = new StandaloneServiceProvider();

  const r1 = new ReceiveEndpoint("r1", owner, {
    didConnect: endpoint => {
      console.log(`didConnect: ${endpoint} ${endpoint.connected}`);
      endpoint.send(endpoint.receive(""));

      const interval = setInterval(
        () => endpoint.send(endpoint.receive("")),
        300
      );

      return () => clearInterval(interval);
    },
    receive: message => `${message}OK R1`
  });

  const http = await sp.declareService({
    name: "http",
    type: ServiceKOA,
    listen: {
      socket: 1236
    },
    endpoints: {
      "/w1": { connected: r1, ws: true }
    }
  });

  const w1 = http.endpoints["/w1"];

  t.is(w1.name, "/w1");
  t.is(w1.path, "/w1");
  t.is(w1.ws, true);
  t.true(w1 instanceof WSEndpoint);

  t.is(w1.connected, r1);
  t.is(r1.connected, w1);

  await http.start();

  const c1 = client();

  await wait(1200);

  t.is(c1.opened, 1);
  t.is(c1.messages[0], "form client OK R1");
  t.is(c1.messages[1], "OK R1");
  t.is(c1.messages[2], "OK R1");
});
