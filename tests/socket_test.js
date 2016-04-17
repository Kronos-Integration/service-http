/* global describe, it, xit, before, beforeEach, after, afterEach */
/* jslint node: true, esnext: true */

'use strict';

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should(),
  fs = require('fs'),
  path = require('path'),
  WebSocket = require('ws'),
  service = require('kronos-service'),
  ServiceKOA = require('../service').Service,
  ServiceProviderMixin = service.ServiceProviderMixin;

class ServiceProvider extends service.ServiceProviderMixin(service.Service) {}

const sp = new ServiceProvider();

describe('service-koa socket', function () {

  //this.timeout(200000);

  const ks1 = new ServiceKOA({
    name: 'my-name1',
    hostname: 'localhost',
    port: 1235
  }, sp);

  const se = ks1.createSocketEndpoint('test', '/test');

  describe('socket endpoint', () => {
    it('is socket', () => assert.isTrue(se.socket));
    it('isOut', () => assert.isTrue(se.isOut));
    it('has opposite', () => assert.isDefined(se.opposite));
    it('opposite isIn', () => assert.isTrue(se.opposite.isIn));
  });

  se.receive = message => {
    console.log(`se: ${message}`);
    return se.opposite.receive(message);
  };

  setInterval(() => {
    se.opposite.receive({
      memory: process.memoryUsage()
    });
  }, 1000);

  const socketUrl = 'ws://localhost:1235/test';

  it('socket', done => {
    ks1.configure({}).then(() => ks1.start().then(() => {

      ks1.koa.use(ctx => {
        ctx.type = 'text/html';
        ctx.body = fs.createReadStream(path.join(__dirname, 'fixtures', 'index.html'));
      });

      const ws = new WebSocket(socketUrl, {});

      ws.on('open', () => ws.send(Date.now().toString(), { mask: true }));
      ws.on('close', () => { console.log('disconnected');});

      ws.on('message', (data, flags) => {
        console.log('Roundtrip time: ' + (Date.now() - parseInt(data)) + 'ms', flags);

        setTimeout(() => {
          ws.send(Date.now().toString(), {
            mask: true
          });
        }, 500);

        done();
      });

      //assert.equal(ks1.state, 'running');
    }));
  });
});
