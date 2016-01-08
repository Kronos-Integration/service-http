/* global describe, it */
/* jslint node: true, esnext: true */

"use strict";

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should(),
  request = require("supertest-as-promised")(Promise),
  kronos = require('kronos-service-manager'),
  ks = require('../koa-service'),
  route = require('koa-route');

describe('koa-service', function () {
  function initManager() {
    return kronos.manager({
      services: {
        'koa': {
          logLevel: "error",
          port: 1234
        }
      }
    }).then(manager => {
      ks.registerWithManager(manager);
      return Promise.resolve(manager);
    });
  }

  describe('koa', function () {

    /*
        describe('default values', function () {
          assert.equal(ks.port, 9898);
        });
    */

    it('GET /', function (done) {
      initManager().then(manager => {
        const ks = manager.services.koa;
        ks.start().then(x => {
          try {
            ks.koa.use(route.get('/', ctx => {
              ctx.body = "OK";
            }));
            request(ks.server.listen())
              .get('/')
              .expect(200)
              .expect(function (res) {
                if (res.text !== 'OK') throw Error("not OK");
              })
              .end(() => {
                ks.stop().then(() => done());
              });
          } catch (e) {
            done(e);
          }
        });
      }, done);
    });
  });
});
