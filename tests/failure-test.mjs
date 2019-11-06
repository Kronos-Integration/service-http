import test from "ava";
import { ServiceProviderMixin, Service } from "@kronos-integration/service";
import { ServiceKOA } from "../src/service-koa.mjs";

class ServiceProvider extends ServiceProviderMixin(Service) {}

const sp = new ServiceProvider();

test("service-koa failures with already in use port", async t => {
  const port = 1235;

  const ks1 = new ServiceKOA(
    {
      name: "my-name1",
      listen: {
        socket: port
      }
    },
    sp
  );

  const ks2 = new ServiceKOA(
    {
      name: "my-name2",
      listen: {
        socket: port
      }
    },
    sp
  );

  await ks1.start();
  t.is(ks1.state, "running");

  await t.throwsAsync(() => ks2.start(), Error, 'listen EADDRINUSE: address already in use :::1235');

  t.is(ks2.state, "failed");

  await ks1.stop();
  //await ks2.stop();
});
