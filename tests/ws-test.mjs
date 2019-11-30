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
  endpointIdentifier(ep) {
    return `owner.${ep.name}`;
  }
};

test("ws send", async t => {
  const sp = new StandaloneServiceProvider();

  let severOppositeOpened = 0;

  const r1 = new ReceiveEndpoint("r1", owner, {
    opposite: {
      opened: endpoint => {
        console.log("opposite opened");
      }
    },

    opened: endpoint => {
      console.log("r1 opened");
      severOppositeOpened++;
      const o = endpoint.opposite;
      endpoint.receive(o.receive());

      const interval = setInterval(() => endpoint.receive(o.receive()), 500);

      return () => clearInterval(interval);
    },
    receive: message => `${message} OK R1`
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
  t.true(w1.isOpen);
  t.true(r1.isOpen);

  await http.start();

  const socketUrl = "ws://localhost:1236/w1";
  const ws = new WebSocket(socketUrl, {});

  let disconnected = 0;
  let opened = 0;

  ws.on("open", () => {
    opened++;

    ws.send("form client", {
      mask: true
    });
  });

  const messages = [];

  ws.on("message", message => {
    messages.push(message);
    console.log("from server:", message);
  });

  ws.on("close", () => {
    disconnected++;
  });

  await wait(2000);

  console.log(messages);
  t.is(opened, 1);
  t.is(messages[0], "form client OK R1");
  // t.is(severOppositeOpened, 1);
  //t.is(disconnected, 1);
});
