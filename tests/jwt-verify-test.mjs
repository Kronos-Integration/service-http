import test from "ava";
import { SendEndpoint } from "@kronos-integration/endpoint";

import { CTXJWTVerifyInterceptor } from "../src/ctx-jwt-verivy-interceptor.mjs";

test("jwt malformed", async t => {
  const endpoint = new SendEndpoint("e", {});

  const interceptor = new CTXJWTVerifyInterceptor();

  let raisedError;

  const ctx = {
    req: {
      headers: { authorization: "Bearer 1234" }
    },
    throw(code) {
      raisedError = code;
    }
  };

  await t.throwsAsync(
    async () =>
      interceptor.receive(endpoint, (ctx, a, b, c) => {}, ctx, 1, 2, 3),
    "jwt malformed"
  );

  //t.is(raisedError, 401);
});
