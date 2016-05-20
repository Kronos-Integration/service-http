/* global describe, it, xit, before, beforeEach, after, afterEach */
/* jslint node: true, esnext: true */

'use strict';

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should(),
  fs = require('fs'),
  path = require('path'),
  address = require('network-address'),
  request = require('supertest-as-promised')(Promise),
  service = require('kronos-service'),
  ServiceKOA = require('../service').Service,
  route = require('koa-route'),
  ServiceProviderMixin = service.ServiceProviderMixin;

class ServiceProvider extends service.ServiceProviderMixin(service.Service) {}

const sp = new ServiceProvider();

describe('service-koa', () => {
  describe('plain http', () => {
    const ks = new ServiceKOA({
      type: 'xxx',
      name: 'my-name',
      listen: {
        port: 1234
      }
    }, sp);

    it('has name', () => assert.equal(ks.name, 'my-name'));
    it('is not secure', () => assert.equal(ks.isSecure, false));

    it('has port', () => assert.equal(ks.listen.port, 1234));

    it('has address', () => assert.equal(ks.listen.address, address()));
    it('has url', () => assert.equal(ks.url, `http://${address()}:1234`));

    describe('configure', () => {
      it('can change port', done => {
        ks.configure({
          listen: {
            port: 1235
          }
        }).then(
          () => {
            assert.equal(ks.listen.port, 1235);
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

  describe('https', () => {
    const ks = new ServiceKOA({
      name: 'my-name',
      key: fs.readFileSync(path.join(__dirname, 'fixtures', 'www.example.com.key')),
      cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'www.example.com.cert')),
      listen: {
        port: 1234
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
              assert.equal(ks.listen.port, 1235);
              assert.equal(ks.listen.address, 'www.example.com');
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
