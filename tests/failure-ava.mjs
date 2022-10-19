import test from "ava";
import { StandaloneServiceProvider,InitializationContext } from "@kronos-integration/service";
import { ServiceHTTP } from "@kronos-integration/service-http";

test("http failures with already in use port", async t => {
  const sp = new StandaloneServiceProvider();
  const ic = new InitializationContext(sp);

  const listen = {
    socket: 1238
  };

  const ks1 = new ServiceHTTP(
    {
      name: "my-name1",
      listen
    },
    ic
  );
  const ks2 = new ServiceHTTP(
    {
      name: "my-name2",
      listen
    },
    ic
  );

  await ks1.start();
  t.is(ks1.state, "running");

  await t.throwsAsync(
    () => ks2.start(),
  //  Error,
    //"listen EADDRINUSE: address already in use :::1238"
  );
  t.is(ks2.state, "failed");

  await ks1.stop();
  await ks2.stop();
});
