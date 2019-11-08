import test from "ava";
import got from "got";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import address from "network-address";
import route from "koa-route";

import { ServiceProviderMixin, Service } from "@kronos-integration/service";
import { ServiceKOA } from "../src/service-koa.mjs";

class ServiceProvider extends ServiceProviderMixin(Service) {}

test("service-koa plain http", async t => {
  const sp = new ServiceProvider();
  const ks = new ServiceKOA(
    {
      type: "xxx",
      name: "my-name",
      listen: {
        socket: 1234,
        address: address()
      }
    },
    sp
  );

  t.is(ks.name, "my-name");
  t.is(ks.isSecure, false);

  t.is(ks.socket, 1234);

  t.is(ks.address, address());
  t.is(ks.url, `http://${address()}:1234`);

  t.is(ks.timeout.server, 120);
  await ks.stop();
});

test("service-koa utl", async t => {
  const sp = new ServiceProvider();
  const ks = new ServiceKOA(
    {
      type: "xxx",
      name: "my-name",
      listen: {
        url: `http://${address()}:1234`
      }
    },
    sp
  );

  t.is(ks.name, "my-name");
  t.is(ks.isSecure, false);

  t.is(ks.socket, 1234);
  t.is(ks.address, address());
  t.is(ks.url, `http://${address()}:1234`);

  t.is(ks.timeout.server, 120);
  await ks.stop();
});

test("service-koa plain http change port", async t => {
  const sp = new ServiceProvider();
  const ks = new ServiceKOA(
    {
      type: "xxx",
      name: "my-name",
      listen: {
        socket: 1234,
        address: address()
      }
    },
    sp
  );

  await ks.configure({
    listen: {
      socket: 1235
    }
  });

  t.is(ks.listen.socket, 1235);

  await ks.configure({
    timeout: {
      server: 123.45
    }
  });

  t.is(ks.timeout.server, 123.45);
  await ks.stop();
});

test("service-koa plain http get /", async t => {
  const sp = new ServiceProvider();
  const ks = new ServiceKOA(
    {
      type: "xxx",
      name: "my-name",
      listen: {
        socket: 1239,
        address: "localhost"
      }
    },
    sp
  );

  ks.koa.use(route.get("/", ctx => (ctx.body = "OK")));
  await ks.start();
  const response = await got(`http://localhost:${ks.listen.socket}/`);
  t.is(response.body, "OK");
  await ks.stop();
});

test("service-koa plain http get", async t => {
  const sp = new ServiceProvider();
  const ks = new ServiceKOA(
    {
      type: "xxx",
      name: "my-name",
      listen: {
        socket: 1234,
        address: "localhost"
      }
    },
    sp
  );

  await ks.start();
  ks.koa.use(route.get("/", ctx => (ctx.body = "OK")));

  t.is(ks.url, `http://localhost:1234`);

  const response = await got(`http://localhost:${ks.listen.socket}/`);

  t.is(response.body, "OK");
  t.is(response.statusCode, 200);

  await ks.stop();
});

const here = dirname(fileURLToPath(import.meta.url));

test.skip("service-koa plain https get", async t => {
  const sp = new ServiceProvider();

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
