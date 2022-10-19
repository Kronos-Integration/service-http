import test from "ava";
import { TestContext } from "./helpers/context.mjs";
import {
  interceptorTest,
  dummyEndpoint
} from "@kronos-integration/test-interceptor";
import { CTXInterceptor } from "@kronos-integration/service-http";

test(
  interceptorTest,
  CTXInterceptor,
  undefined,
  { json: { headers: {}, type: "ctx" } },
  dummyEndpoint("e1"),
  [new TestContext({ body: "" })],
  () => undefined,
  async (t, interceptor, endpoint, next, result, ctx) => {
    t.is(ctx.code, 200);
  }
);

test(
  interceptorTest,
  CTXInterceptor,
  {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  },
  {
    json: {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate"
      },
      type: "ctx"
    }
  },
  dummyEndpoint("e1"),
  [new TestContext({ body: "" }), "extra1"],
  () => "result",
  async (t, interceptor, endpoint, next, result, ctx) => {
    t.is(ctx.code, 200);
    t.is(ctx.headers["cache-control"], "no-store, no-cache, must-revalidate");
  }
);
