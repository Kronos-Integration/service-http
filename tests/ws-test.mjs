import test from "ava";
import WebSocket from "ws";
import { SendEndpoint,ReceiveEndpoint } from "@kronos-integration/endpoint";
import { StandaloneServiceProvider } from "@kronos-integration/service";
import { ServiceHTTP } from "../src/service-http.mjs";
import { WSEndpoint } from "../src/ws-endpoint.mjs";

async function wait(msecs = 1000) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), msecs);
  });
}

const owner = {
  name: "owner",
  info(...args) { console.log(...args); },
  trace(...args) { console.log(...args); },
  error(...args) { console.log(...args); }
};

function client(name) {
  const socketUrl = "ws://localhost:1236/w1";

  const ws = new WebSocket(socketUrl, {});

  const r = { name, messages: [], ws, disconnected: 0, opened: 0 };

  ws.on("open", () => {
    r.opened++;

    ws.send(`form ${name} `, {
      mask: true
    });
  });

  ws.on("message", message => {
    r.messages.push(message);
  });

  ws.on("close", () => {
    r.disconnected++;
  });

  return r;
}

test("ws send", async t => {
  const sp = new StandaloneServiceProvider();

  const r1 = new SendEndpoint("r1", owner, {
    didConnect: endpoint => {
      console.log(`didConnect: ${endpoint} ${endpoint.connected}`);
     // endpoint.send(endpoint.receive(""));

      const interval = setInterval(
        () => endpoint.send(endpoint.receive("")),
        300
      );

      return () => clearInterval(interval);
    },
    receive: message => `${message}OK R1`
  });

  const http = await sp.declareService({
    type: ServiceHTTP,
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

  t.true(w1.isConnected(r1));
  t.true(r1.isConnected(w1));

  await http.start();

  const clients = [1,2].map(i => client(i));

  await wait(1200);

  for (const c of clients) {
    t.is(c.opened, 1, "opened");
    t.is(c.messages[0], `form ${c.name} OK R1`, "server message 0");
    t.is(c.messages[1], "OK R1", "server message 1");
    t.is(c.messages[2], "OK R1", "server message 2");
  }
});
