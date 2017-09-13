/* global describe, it, xit, before, beforeEach, after, afterEach */
/* jslint node: true, esnext: true */

'use strict';

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should(),
  {
    ServiceProviderMixin, Service
  } = require('kronos-service'),
  {
    ServiceKOA
  } = require('../dist/module');

class ServiceProvider extends ServiceProviderMixin(Service) {}

const sp = new ServiceProvider();

describe('service-koa failures', () => {
  describe('with already in use port', () => {
    const ks1 = new ServiceKOA({
      name: 'my-name1',
      listen: { 
        port: 1235
      }
    }, sp);

    const ks2 = new ServiceKOA({
      name: 'my-name2',
      listen: { 
        port: 1235
      }
    }, sp);

    it('can start', () => {
      ks1.start().then(() => ks2.start().then(() => {
        assert.equal(ks1.state, 'running');
        assert.equal(ks2.state, 'running');
      }));
    });
  });
});
