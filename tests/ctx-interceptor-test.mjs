import test from "ava";
import { SendEndpoint } from "@kronos-integration/endpoint";
import { StandaloneServiceProvider } from "@kronos-integration/service";
import { ServiceHTTP } from "../src/service-http.mjs";
import { CTXInterceptor } from "../src/ctx-interceptor.mjs";

test("defaults", async t => {
  const interceptor = new CTXInterceptor();
  t.deepEqual(interceptor.headers, {});
});

test("default headers", async t => {
  const sp = new StandaloneServiceProvider();
  const http = await sp.declareService({
    type: ServiceHTTP
  });
  const endpoint = new SendEndpoint("e", http);

  const configuredHeaders = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: 0
  };

  const interceptor = new CTXInterceptor({
    headers: configuredHeaders
  });

  t.deepEqual(interceptor.headers, configuredHeaders);

  let raisedError;
  let end,
    code,
    headers = {};

  const ctx = {
    res: {
      setHeader(k, v) {
        headers[k] = v;
      },
      writeHead(c, h) {
        code = c;
        headers = h;
      },
      end(arg) {
        end = arg;
      }
    },
    req: {
      headers: {}
    },
    throw(code) {
      raisedError = code;
    }
  };

  await interceptor.receive(endpoint, (ctx, a, b, c) => {}, ctx, 1, 2, 3);

  t.is(code, 200);
  t.is(headers["Cache-Control"], "no-store, no-cache, must-revalidate");
});
