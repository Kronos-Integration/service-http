/* global describe, it */
/* jslint node: true, esnext: true */

"use strict";

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should(),
  request = require("supertest-as-promised")(Promise),
  kronos = require('kronos-service-manager'),
  ks = require('../koa-service');

chai.use(require("chai-as-promised"));

describe('koa-service', function () {
  function initManager() {
    return kronos.manager({
      services: {
        'koa': {
          logLevel: "error"
        }
      }
    }).then(manager => {
      ks.registerWithManager(manager);
      return Promise.resolve(manager);
    });
  }

  describe('koa', function () {
    it('GET /', function (done) {
      initManager().then(function (manager) {
        const ks = manager.services.koa;

        try {
          request(ks.server.listen())
            .get('/')
            .expect(200)
            .expect(function (res) {
              if (res.text !== 'OK') throw Error("not OK");
            })
            .end(done);
        } catch (e) {
          done(e);
        }
      }, done);
    });
  });
});
