const fs = require('fs');
const path = require('path');
const address = require('network-address');
const route = require('koa-route');

import { ServiceProviderMixin, Service } from 'kronos-service';
import { ServiceKOA } from '../src/service-koa';
import test from 'ava';
import got from 'got';

class ServiceProvider extends ServiceProviderMixin(Service) {}

test('service-koa plain http', async t => {
  const sp = new ServiceProvider();
  const ks = new ServiceKOA(
    {
      type: 'xxx',
      name: 'my-name',
      listen: {
        port: 1234,
        address: address()
      }
    },
    sp
  );

  t.is(ks.name, 'my-name');
  t.is(ks.isSecure, false);

  t.is(ks.port, 1234);

  t.is(ks.address, address());
  t.is(ks.url, `http://${address()}:1234`);

  t.is(ks.timeout.server, 120);
  await ks.stop();
});

test('service-koa plain http change port', async t => {
  const sp = new ServiceProvider();
  const ks = new ServiceKOA(
    {
      type: 'xxx',
      name: 'my-name',
      listen: {
        port: 1234,
        address: address()
      }
    },
    sp
  );

  await ks.configure({
    listen: {
      port: 1235
    }
  });

  t.is(ks.listen.port, 1235);

  await ks.configure({
    timeout: {
      server: 123.45
    }
  });

  t.is(ks.timeout.server, 123.45);
  await ks.stop();
});

test('service-koa plain http get /', async t => {
  const sp = new ServiceProvider();
  const ks = new ServiceKOA(
    {
      type: 'xxx',
      name: 'my-name',
      listen: {
        port: 1236,
        address: address()
      }
    },
    sp
  );

  ks.koa.use(route.get('/', ctx => (ctx.body = 'OK')));

  const response = await got(`http://localhost:${ks.listen.port}/`);
  t.is(response.body, 'OK');
  await ks.stop();
});

/*
      ks.start().then(() => {
        ks.koa.use(route.get('/', ctx => ctx.body = 'OK'));
        request(ks.server.listen())
          .get('/')
          .expect(200)
          .expect(res => assert.equal(res.text, 'OK'))
          .end(() => ks.stop());
      }));
  });

  describe('https', () => {
    const ks = new ServiceKOA({
      name: 'my-name',
      key: fs.readFileSync(path.join(__dirname, 'fixtures', 'www.example.com.key')),
      cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'www.example.com.cert')),
      listen: {
        port: 1234,
        address: address()
      }
    }, sp);

    it('is secure', () => assert.isTrue(ks.isSecure));
    it('has port', () => assert.equal(ks.listen.port, 1234));
    it('has url', () => assert.equal(ks.url, `https://${address()}:1234`));

    describe('configure', () => {
      it('can change port', done => {
        ks.configure({
          listen: {
            port: 1235,
            address: 'www.example.com'
          }
        }).then(
          () => {
            try {
              assert.equal(ks.port, 1235);
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
    it('GET /', () =>
      ks.start().then(() => {
        ks.koa.use(route.get('/', ctx => ctx.body = 'OK'));
        request(ks.server.listen())
          .get('/')
          .expect(200)
          .expect(res => assert.equal(res.text, 'OK'))
          .end(() => ks.stop());
      }));
  });
});

*/
