import test from "ava";
import got from "got";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import route from "koa-route";

import { StandaloneServiceProvider } from "@kronos-integration/service";
import { ServiceKOA } from "../src/service-koa.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test.skip("service-koa plain https get", async t => {
  const sp = new StandaloneServiceProvider();

  const addr = "localhost"; // address();
  const PORT = 1239;
  const ks = new ServiceKOA(
    {
      loglLevel: "trace",
      name: "my-name",
      key: readFileSync(
        join(here, "..", "tests", "fixtures", "www.example.com.key")
      ),
      cert: readFileSync(
        join(here, "..", "tests", "fixtures", "www.example.com.cert")
      ),
      listen: {
        socket: PORT,
        address: addr
      }
    },
    sp
  );

  t.is(ks.isSecure, true);
  t.is(ks.listen.socket, PORT);
  t.is(ks.url, `https://${addr}:${PORT}`);

  await ks.start();

  ks.koa.use(route.get("/", ctx => (ctx.body = "OK")));

  const response = await got(`${ks.url}/`);

  t.is(response.body, "OK");
  t.is(response.statusCode, 200);

  await ks.stop();
});

/*
  describe('https', () => {
    describe('configure', () => {
      it('can change port', done => {
        ks.configure({
          listen: {
            socket: 1235,
            address: 'www.example.com'
          }
        }).then(
          () => {
            try {
              assert.equal(ks.socket, 1235);
              assert.equal(ks.address, 'www.example.com');
              assert.isTrue(ks.isSecure);
              assert.equal(ks.url, 'https://www.example.com:1235');
            } catch (e) {
              console.log(e);
              done(e);
              return;
            }
            done();
          }
        );
      });
    });
  });
});
*/
