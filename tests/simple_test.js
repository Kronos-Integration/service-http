/* global describe, it */
/* jslint node: true, esnext: true */

"use strict";

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should(),
  request = require("supertest-as-promised")(Promise),
  service = require('kronos-service'),
  ServiceKOA = require('../koa-service'),
  route = require('koa-route'),
  ServiceProviderMixin = service.ServiceProviderMixin,
  ServiceConfig = service.ServiceConfig;

class _ServiceProvider {}
class ServiceProvider extends service.ServiceProviderMixin(_ServiceProvider) {}

describe('koa-service', () => {
  const ks = new ServiceKOA({
    port: 1234
  });

  describe('config', () => {
    it('has port', () => {
      assert.equal(ks.port, 1234);
    });

    it('has url', () => {
      assert.equal(ks.url, 'http://localhost:1234');
    });

    describe('configure', () => {
      it('can change port', done => {
        ks.configure({
          port: 1235
        }).then(
          () => {
            assert.equal(ks.port, 1235);
            done();
          }
        );
      });
    });
  });


  it('GET /', done => {
    ks.start().then(x => {
      try {
        ks.koa.use(route.get('/', ctx => {
          ctx.body = "OK";
        }));
        request(ks.server.listen())
          .get('/')
          .expect(200)
          .expect(res => {
            if (res.text !== 'OK') done(Error("not OK"));
          })
          .end(() => {
            ks.stop().then(() => done());
          });
      } catch (e) {
        done(e);
      }
    });
  });
});
