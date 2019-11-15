import test from "ava";
import fs from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import WebSocket from "ws";
import { StandaloneServiceProvider } from "@kronos-integration/service";
import { ServiceKOA } from "../src/service-koa.mjs";


const here = dirname(fileURLToPath(import.meta.url));

const sp = new StandaloneServiceProvider();

test.skip("service-koa socket", async t => {
  const ks1 = new ServiceKOA(
    {
      name: "my-name1",
      listen: {
        address: "localhost",
        socket: 1236
      }
    },
    sp
  );

  const se = ks1.createSocketEndpoint("test", "/test");

  t.is(se.socket, true);
  t.is(se.isOut, true);
  t.truthy(se.opposite);
  t.truthy(se.opposite.isIn);

  se.receive = message => {
    console.log(`se: ${message}`);
    return se.opposite.receive(message);
  };

  const socketUrl = "ws://localhost:1236/test";

  await ks1.configure({
    listen: {
      address: "localhost",
      socket: 1236
    }
  });

  await ks1.start();

  ks1.koa.use(ctx => {
    ctx.type = "text/html";
    ctx.body = fs.createReadStream(
      join(here, "fixtures", "index.html")
    );
  });

  const ws = new WebSocket(socketUrl, {});

  ws.on("open", () =>
    ws.send(Date.now().toString(), {
      mask: true
    })
  );
  ws.on("close", () => {
    console.log("disconnected");
  });

  await new Promise((resolve, reject) => {
    ws.on("message", (data, flags) => {
      console.log(
        "Roundtrip time: " + (Date.now() - parseInt(data, 10)) + "ms",
        flags
      );
      resolve();
      /*
          setTimeout(() => {
            ws.send(Date.now().toString(), {
              mask: true
            });
          }, 500);
  */
    });
  });
});
