import test from "ava";
import { StandaloneServiceProvider } from "@kronos-integration/service";
import { ServiceKOA } from "../src/service-koa.mjs";

test("service-koa failures with already in use port", async t => {
  const sp = new StandaloneServiceProvider();

  const listen = {
    socket: 1238
  };

  const ks1 = new ServiceKOA(
    {
      name: "my-name1",
      listen
    },
    sp
  );
  const ks2 = new ServiceKOA(
    {
      name: "my-name2",
      listen
    },
    sp
  );

  await ks1.start();
  t.is(ks1.state, "running");

  await t.throwsAsync(
    () => ks2.start(),
    Error,
    "listen EADDRINUSE: address already in use :::1238"
  );
  t.is(ks2.state, "failed");

  await ks1.stop();
  await ks2.stop();
});
