import { ServiceProviderMixin, Service } from 'kronos-service';
import { ServiceKOA } from '../src/service-koa';
import test from 'ava';

class ServiceProvider extends ServiceProviderMixin(Service) {}

const sp = new ServiceProvider();

test('service-koa failures with already in use port', async t => {
  const ks1 = new ServiceKOA(
    {
      name: 'my-name1',
      listen: {
        port: 1235
      }
    },
    sp
  );

  const ks2 = new ServiceKOA(
    {
      name: 'my-name2',
      listen: {
        port: 1235
      }
    },
    sp
  );

  await ks1.start();
  t.is(ks1.state, 'running');
  await ks1.stop();

  try {
    await ks2.start();
  } catch (e) {}

  t.is(ks2.state, 'failed');

  await ks1.stop();
  await ks2.stop();
});
