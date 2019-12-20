import test from "ava";
import { SendEndpoint } from "@kronos-integration/endpoint";

import { CTXJWTVerifyInterceptor } from "../src/ctx-jwt-verivy-interceptor.mjs";

test("jwt malformed", async t => {
  const endpoint = new SendEndpoint("e", {});
  const interceptor = new CTXJWTVerifyInterceptor();

  let raisedError;
  let end;

  const ctx = {
    res: {
      writeHead() {},
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

  t.is(end, "jwt malformed");

  //t.is(raisedError, 401);
});

test("jwt not configured", async t => {
  const endpoint = new SendEndpoint("e", {});
  const interceptor = new CTXJWTVerifyInterceptor();

  let raisedError;
  let end;

  const ctx = {
    res: {
      writeHead() {},
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

  t.is(end, "secret or public key must be provided");
});
