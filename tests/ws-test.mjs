import test from "ava";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

import jwt from "jsonwebtoken";
import WebSocket from "ws";
import { SendEndpoint } from "@kronos-integration/endpoint";
import { Interceptor } from "@kronos-integration/interceptor";
import { StandaloneServiceProvider } from "@kronos-integration/service";
import { ServiceHTTP, WSEndpoint } from "@kronos-integration/service-http";

const here = dirname(fileURLToPath(import.meta.url));

const token = jwt.sign({}, readFileSync(join(here, "fixtures", "demo.rsa")), {
  algorithm: "RS256",
  expiresIn: "12h"
});

async function wait(msecs = 1000) {
  return new Promise((resolve, reject) => setTimeout(() => resolve(), msecs));
}

export class WSTestInterceptor extends Interceptor {
  async receive(endpoint, next, arg) {
    return next("<" + arg + ">");
  }
}

function client(name) {
  const socketUrl = "ws://localhost:1250/w1";

  const ws = new WebSocket(socketUrl, ["access_token", token]);

  const r = { name, messages: [], ws, disconnected: 0, opened: 0 };

  ws.on("open", () => {
    r.opened++;

    ws.send(`form ${name} `, {
      mask: true
    });
  });

  ws.on("message", message => {
    //console.log("MESSAGE", name, message);
    r.messages.push(message);
  });

  ws.on("close", () => {
    r.disconnected++;
  });

  return r;
}

test("ws send", async t => {
  const sp = new StandaloneServiceProvider();

  const r1 = new SendEndpoint("r1", sp, {
    didConnect: endpoint => {
      //endpoint.send("R1 didConnect");

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
      socket: 1250
    },
    jwt: {
      public: readFileSync(join(here, "fixtures", "demo.rsa.pub"))
    },
    endpoints: {
      "/w1": {
        connected: r1,
        ws: true,
        receivingInterceptors: [new WSTestInterceptor()]
      }
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

  const clients = [1, 2].map(i => client(i));

  await wait(1200);

  for (const c of clients) {
    t.is(c.opened, 1, "opened");
    t.is(c.messages[0], `form ${c.name} OK R1`, "server message 0");
    t.is(c.messages[1], "<OK R1>", "server message 1");
    t.is(c.messages[2], "<OK R1>", "server message 2");
  }

  await http.stop();
});
