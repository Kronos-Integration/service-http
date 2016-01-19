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
            if (res.text !== 'OK') throw Error("not OK");
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
