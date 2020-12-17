import test from "ava";
import address from "network-address";
import got from "got";
import { readFileSync } from "fs";

import { ReceiveEndpoint } from "@kronos-integration/endpoint";
import {
  StandaloneServiceProvider,
  InitializationContext
} from "@kronos-integration/service";
import {
  ServiceHTTP,
  HTTPEndpoint,
  CTXInterceptor
} from "@kronos-integration/service-http";

async function skt(t, config, ...args) {
  let expected = args.pop() || {};
  const updates = args.pop() || [];

  expected = {
    testConnection: true,
    isSecure: false,
    timeout: { server: 120 },
    ...expected
  };
  const sp = new StandaloneServiceProvider();
  const ic = new InitializationContext(sp);
  const ks = new ServiceHTTP(config, ic);

  for (const u of updates) {
    await ks.configure(u);
  }

  ["socket"].forEach(a => {
    if (expected[a] !== undefined) {
      t.deepEqual(ks[a], expected[a], a);
    }
  });

  ["name", "isSecure", "url", "address"].forEach(a => {
    if (expected[a] !== undefined) {
      t.is(ks[a], expected[a], a);
    }
  });

  for (const name of Object.keys(expected.timeout)) {
    t.is(ks.timeout[name], expected.timeout[name], `timeout ${name}`);
  }

  const r = new ReceiveEndpoint("r1", ks);
  r.receive = async () => "OK";

  const s = ks.addEndpoint(
    new HTTPEndpoint("/", ks, {
      interceptors: [CTXInterceptor],
      connected: r
    })
  );

  if (ks.url === undefined) {
    return;
  }

  t.is(ks.state, "stopped");

  if (expected.testConnection) {
    await ks.start();
    t.is(ks.state, "running");

    try {
      const response = await got(ks.url, {
        https: { certificateAuthority: config.cert }
      });
      t.is(response.body, "OK", "body");
      t.is(response.statusCode, 200, "status");
    } catch (e) {
      t.true(false, ks.url);
    }
  }
  await ks.stop();
  t.is(ks.state, "stopped");
}

skt.title = (providedTitle = "http", config, updates) => {
  const c = { ...config };
  delete c.key;
  delete c.cert;

  return `${providedTitle} ${
    config === undefined ? "undefined" : JSON.stringify(c)
  }${Array.isArray(updates) ? " updates " + JSON.stringify(updates) : ""}`.trim();
};

test(
  skt,
  {},
  {
    isSecure: false,
    url: undefined,
    socket: undefined
  }
);

test(skt, undefined, {
  isSecure: false,
  url: undefined,
  socket: undefined
});

test(
  skt,
  {
    name: "my-name",
    listen: {
      socket: 1300,
      address: address()
    }
  },
  {
    name: "my-name",
    adrress: address(),
    socket: 1300,
    url: `http://${address()}:1300`
  }
);

test(
  skt,
  {
    listen: {
      url: `http://${address()}:1301`
    }
  },
  {
    adrress: address(),
    socket: 1301,
    url: `http://${address()}:1301`
  }
);

test(
  skt,
  {
    listen: {
      url: `http://localhost:1302`
    }
  },
  {
    adrress: address(),
    socket: 1302,
    url: `http://localhost:1302`
  }
);

test(
  skt,
  {
    listen: {
      url: `http://${address()}:1303`
    }
  },
  [
    {
      listen: {
        socket: 1304
      }
    },
    {
      timeout: {
        server: 123.45
      }
    }
  ],
  {
    adrress: address(),
    socket: 1304,
    url: `http://${address()}:1304`,
    timeout: {
      server: 123.45
    }
  }
);

test(
  skt,
  {
    key: readFileSync(
      new URL("fixtures/www.example.com.key", import.meta.url).pathname
    ),
    cert: readFileSync(
      new URL("fixtures/www.example.com.cert", import.meta.url).pathname
    ),
    listen: {
      address: "localhost",
      socket: 1305
    }
  },
  {
    isSecure: true,
    url: `https://localhost:1305`
  }
);

test(
  skt,
  {
    listen: {
      socket: { fd: 4, name: "service.http" }
    }
  },
  {
    testConnection: false,
    socket: { fd: 4, name: "service.http" },
    url: `fd:///4`
  }
);
