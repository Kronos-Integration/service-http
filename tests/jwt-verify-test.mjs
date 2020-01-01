import test from "ava";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import jwt from "jsonwebtoken";

import { SendEndpoint } from "@kronos-integration/endpoint";
import { StandaloneServiceProvider } from "@kronos-integration/service";
import { ServiceHTTP } from "../src/service-http.mjs";
import { CTXJWTVerifyInterceptor } from "../src/ctx-jwt-verivy-interceptor.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const pubKey = readFileSync(join(here, "fixtures", "demo.rsa.pub"));

test("jwt malformed", async t => {
  const sp = new StandaloneServiceProvider();
  const http = await sp.declareService({
    type: ServiceHTTP,
    jwt: { public: pubKey }
  });
  const endpoint = new SendEndpoint("e", http);
  const interceptor = new CTXJWTVerifyInterceptor();

  let raisedError;
  let end, code, headers;

  const ctx = {
    res: {
      writeHead(c, h) {
        code = c;
        headers = h;
      },
      end(arg) {
        end = arg;
      }
    },
    req: {
      headers: { authorization: "Bearer 1234" }
    },
    throw(code) {
      raisedError = code;
    }
  };

  await interceptor.receive(endpoint, (ctx, a, b, c) => {}, ctx, 1, 2, 3);

  t.is(code, 401);
  t.regex(headers["WWW-Authenticate"], /Bearer,error/);
  t.is(end, "jwt malformed");

  //t.is(raisedError, 401);
});

test("jwt not configured", async t => {
  const sp = new StandaloneServiceProvider();
  const http = await sp.declareService({
    type: ServiceHTTP,
  //  jwt: { public: pubKey }
  });
  const endpoint = new SendEndpoint("e", http);
  const interceptor = new CTXJWTVerifyInterceptor();

  let raisedError;
  let end, code, headers;

  const ctx = {
    res: {
      writeHead(c, h) {
        code = c;
        headers = h;
      },
      end(arg) {
        end = arg;
      }
    },
    req: {
      headers: {
        authorization:
          "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbnRpdGxlbWVudHMiOiJrb25zdW0sY2ksY2kucXVldWVzLnZpZXcsY2kubm9kZXMudmlldyxjaS5ub2Rlcy5yZXN0YXJ0LGtvbnN1bS5jYXRlZ29yaWVzLnJlYWQsa29uc3VtLnZhbHVlcy5yZWFkLGtvbnN1bS52YWx1ZXMuaW5zZXJ0LGNpLnF1ZXVlcy5yZWFkLGNpLm5vZGVzLnJlYWQsY2ksc3lzdGVtLWRhc2Jib2FyZCIsImlhdCI6MTU3NjgwODMyMiwiZXhwIjoxNTc2ODUxNTIyfQ.j5wU4pQ52iyYtSlINsrprNGBTpjZm3-gJTlF3pie29BWJqhvAS4pyoZdKqe-lmFemI8eMYenKdQjQIKYFVGkZdnIkTPgreyLl8iGeK1tmDhYu8MTkLozt1Pp9IUp1FIUEylhHBASW_fz_4gh6xEfUt2MMH6NGDh_hSQhOa83_xU"
      }
    },
    throw(code) {
      raisedError = code;
    }
  };

  await interceptor.receive(endpoint, (ctx, a, b, c) => {}, ctx, 1, 2, 3);

  t.is(code, 401);
  t.regex(headers["WWW-Authenticate"], /Bearer,error/);
  t.is(end, "secret or public key must be provided");
});

test.only("jwt verify none alg as not supported", async t => {
  const sp = new StandaloneServiceProvider();
  const http = await sp.declareService({
    type: ServiceHTTP,
    jwt: { public: pubKey }
  });
  const endpoint = new SendEndpoint("e", http);
  const interceptor = new CTXJWTVerifyInterceptor();

  const token = jwt.sign({}, "" /*readFileSync(join(here, "fixtures", "demo.rsa"))*/, {
    algorithm: "none",
    expiresIn: "12h"
  });
  
  let raisedError;
  let end, code, headers;

  const ctx = {
    res: {
      writeHead(c, h) {
        code = c;
        headers = h;
      },
      end(arg) {
        end = arg;
      }
    },
    req: {
      headers: {
        authorization: `Bearer ${token}`
      }
    },
    throw(code) {
      raisedError = code;
    }
  };

  let next = false;

  await interceptor.receive(endpoint, (ctx, a, b, c) => { next = true; }, ctx, 1, 2, 3);

  t.false(next);

  t.is(code, 401);
  t.regex(headers["WWW-Authenticate"], /Bearer,error/);
  t.is(end, "jwt signature is required");
});

test("jwt verify ok", async t => {
  const sp = new StandaloneServiceProvider();
  const http = await sp.declareService({
    type: ServiceHTTP,
    jwt: { public: pubKey }
  });
  const endpoint = new SendEndpoint("e", http);
  const interceptor = new CTXJWTVerifyInterceptor();

  const token = jwt.sign({}, readFileSync(join(here, "fixtures", "demo.rsa")), {
    algorithm: "RS256",
    expiresIn: "12h"
  });
  
  let raisedError;
  let end, code, headers;

  const ctx = {
    res: {
      writeHead(c, h) {
        code = c;
        headers = h;
      },
      end(arg) {
        end = arg;
      }
    },
    req: {
      headers: {
        authorization: `Bearer ${token}`
      }
    },
    throw(code) {
      raisedError = code;
    }
  };

  let next = false;

  await interceptor.receive(endpoint, (ctx, a, b, c) => { next = true; }, ctx, 1, 2, 3);

  t.true(next);
});
