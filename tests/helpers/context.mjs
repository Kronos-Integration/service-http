export class TestContext {
  constructor(options = {}) {
    this.headers = {};

    this.res = {
      setHeader: (k, v) => {
        this.headers[k] = v;
      },
      writeHead: (c, h) => {
        this.code = c;
        this.headers = lowercaseKeys(h);
      },
      end: arg => {
        this.end = arg;
      }
    };

    this.req = {
      headers: { ...lowercaseKeys(options.headers) },
      async *[Symbol.asyncIterator]() {
        yield *options.body;
       // yield "{}";
      }
    };
  }

  is(type) {
    return this.req.headers["content-type"] == type;
  }

  throw(code) {
    this.raisedError = code;
  }
}

function lowercaseKeys(object) {
  if (object) {
    return Object.fromEntries(
      Object.entries(object).map(([k, v]) => [k.toLowerCase(), v])
    );
  }
}
