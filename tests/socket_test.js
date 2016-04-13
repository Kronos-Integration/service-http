/* global describe, it, xit, before, beforeEach, after, afterEach */
/* jslint node: true, esnext: true */

'use strict';

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should(),
  fs = require('fs'),
  path = require('path'),
  io = require('socket.io-client'),
  service = require('kronos-service'),
  ServiceKOA = require('../service').Service,
  ServiceProviderMixin = service.ServiceProviderMixin;

class ServiceProvider extends service.ServiceProviderMixin(service.Service) {}

const sp = new ServiceProvider();


describe('service-koa socket', function () {

  this.timeout(200000);

  const ks1 = new ServiceKOA({
    name: "my-name1",
    hostname: 'localhost',
    port: 1235,
    io: {}
  }, sp);

  let socketUrl = 'http://localhost:1235/';

  it('socket', done => {
    ks1.configure({}).then(() => ks1.start().then(() => {

      console.log('A');
      ks1.koa.use(ctx => {
        ctx.type = 'text/html';
        ctx.body = fs.createReadStream(path.join(__dirname, 'fixtures', 'index.html'));
      });

      console.log('B');

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
