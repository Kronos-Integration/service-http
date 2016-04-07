/* global describe, it, xit, before, beforeEach, after, afterEach */
/* jslint node: true, esnext: true */

"use strict";

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should(),
  io = require('socket.io-client'),
  service = require('kronos-service'),
  ServiceKOA = require('../service').Service,
  ServiceProviderMixin = service.ServiceProviderMixin;

class ServiceProvider extends service.ServiceProviderMixin(service.Service) {}

const sp = new ServiceProvider();


describe('service-koa socket', function () {

  this.timeout(2000);

  const ks1 = new ServiceKOA({
    name: "my-name1",
    port: 1235,
    io: {}
  }, sp);

  var socketUrl = 'http://localhost:1235';

  it('socket', (done) => {
    ks1.configure({}).then(() => ks1.start().then(() => {

      console.log('A1');

      const socket = io(socketUrl);
      socket.on('connect', () => {
        console.log('connect');
        done();
      });
      socket.on('event', (data) => {
        console.log('event');
      });
      socket.on('disconnect', () => {
        console.log('disconnect');
      });

      //assert.equal(ks1.state, 'running');
    }));
  });
});
