import test from "ava";
import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";
import { TestContext } from "./helpers/context.mjs";
import { SendEndpoint } from "@kronos-integration/endpoint";
import { StandaloneServiceProvider } from "@kronos-integration/service";
import {
  ServiceHTTP,
  CTXJWTVerifyInterceptor
} from "@kronos-integration/service-http";

const pubKey = readFileSync(
  new URL("fixtures/demo.rsa.pub", import.meta.url).pathname
);

test("jwt malformed", async t => {
  const sp = new StandaloneServiceProvider();
  const http = await sp.declareService({
    type: ServiceHTTP,
    jwt: { public: pubKey }
  });
  const endpoint = new SendEndpoint("e", http);
  const interceptor = new CTXJWTVerifyInterceptor();

  const ctx = new TestContext({
    headers: { authorization: "Bearer 1234" }
  });

  await interceptor.receive(endpoint, (ctx, a, b, c) => {}, ctx, 1, 2, 3);

  t.is(ctx.code, 401);
  t.regex(ctx.headers["www-authenticate"], /Bearer,error/);
  t.is(ctx.end, "error: jwt malformed");

  //t.is(raisedError, 401);
});

test("jwt not configured", async t => {
  const sp = new StandaloneServiceProvider();
  const http = await sp.declareService({
    type: ServiceHTTP
    //  jwt: { public: pubKey }
  });
  const endpoint = new SendEndpoint("e", http);
  const interceptor = new CTXJWTVerifyInterceptor();

  const ctx = new TestContext({
    headers: {
      authorization:
        "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbnRpdGxlbWVudHMiOiJrb25zdW0sY2ksY2kucXVldWVzLnZpZXcsY2kubm9kZXMudmlldyxjaS5ub2Rlcy5yZXN0YXJ0LGtvbnN1bS5jYXRlZ29yaWVzLnJlYWQsa29uc3VtLnZhbHVlcy5yZWFkLGtvbnN1bS52YWx1ZXMuaW5zZXJ0LGNpLnF1ZXVlcy5yZWFkLGNpLm5vZGVzLnJlYWQsY2ksc3lzdGVtLWRhc2Jib2FyZCIsImlhdCI6MTU3NjgwODMyMiwiZXhwIjoxNTc2ODUxNTIyfQ.j5wU4pQ52iyYtSlINsrprNGBTpjZm3-gJTlF3pie29BWJqhvAS4pyoZdKqe-lmFemI8eMYenKdQjQIKYFVGkZdnIkTPgreyLl8iGeK1tmDhYu8MTkLozt1Pp9IUp1FIUEylhHBASW_fz_4gh6xEfUt2MMH6NGDh_hSQhOa83_xU"
    }
  });

  await interceptor.receive(endpoint, (ctx, a, b, c) => {}, ctx, 1, 2, 3);

  t.is(ctx.code, 401);
  t.regex(ctx.headers["www-authenticate"], /Bearer,error/);
  t.is(ctx.end, "error: secret or public key must be provided");
});

test("jwt verify none alg not supported", async t => {
  const sp = new StandaloneServiceProvider();
  const http = await sp.declareService({
    type: ServiceHTTP,
    jwt: { public: pubKey }
  });
  const endpoint = new SendEndpoint("e", http);
  const interceptor = new CTXJWTVerifyInterceptor();

  const token = jwt.sign(
    {},
    "",
    {
      algorithm: "none",
      expiresIn: "12h"
    }
  );

  const ctx = new TestContext({
    headers: { authorization: `Bearer ${token}` }
  });

  let next = false;

  await interceptor.receive(
    endpoint,
    (ctx, a, b, c) => {
      next = true;
    },
    ctx,
    1,
    2,
    3
  );

  t.false(next);

  t.is(ctx.code, 401);
  t.regex(ctx.headers["www-authenticate"], /Bearer,error/);
  t.is(ctx.end, "error: jwt signature is required");
});

test("jwt verify ok", async t => {
  const sp = new StandaloneServiceProvider();
  const http = await sp.declareService({
    type: ServiceHTTP,
    jwt: { public: pubKey }
  });
  const endpoint = new SendEndpoint("e", http);
  const interceptor = new CTXJWTVerifyInterceptor();

  const token = jwt.sign(
    { entitlements: ['a','b','c'] },
    readFileSync(new URL("fixtures/demo.rsa", import.meta.url).pathname),
    {
      algorithm: "RS256",
      expiresIn: "12h"
    }
  );

  const ctx = new TestContext({
    headers: { authorization: `Bearer ${token}` }
  });

  let next = false;

  await interceptor.receive(
    endpoint,
    (ctx, a, b, c) => {
      next = true;
    },
    ctx,
    1,
    2,
    3
  );

  t.true(next);
});

test("jwt verify insufficient entitlements", async t => {
  const sp = new StandaloneServiceProvider();
  const http = await sp.declareService({
    type: ServiceHTTP,
    jwt: { public: pubKey }
  });
  const endpoint = new SendEndpoint("e", http);
  const interceptor = new CTXJWTVerifyInterceptor({requiredEntitlements:['a','b','c','d']});

  const token = jwt.sign(
    { entitlements: ['a','b','c'] },
    readFileSync(new URL("fixtures/demo.rsa", import.meta.url).pathname),
    {
      algorithm: "RS256",
      expiresIn: "12h"
    }
  );

  const ctx = new TestContext({
    headers: { authorization: `Bearer ${token}` }
  });

  let next = false;

  await interceptor.receive(
    endpoint,
    (ctx, a, b, c) => {
      next = true;
    },
    ctx,
    1,
    2,
    3
  );
  t.false(next);

  t.is(ctx.code, 403);
  t.regex(ctx.headers["www-authenticate"], /Bearer,error/);
  t.is(ctx.end, "error: Insufficient entitlements");
});
