export class TestContext {
  constructor(options = {}) {
    this.headers = {};

    this.res = {
      setHeader: (k, v) => {
        this.headers[k] = v;
      },
      writeHead: (code, h) => {
        this.code = code;
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
      }
    };
  }

  is(type) {
    return this.req.headers["content-type"] == type;
  }

  throw(code) {
    this.raisedError = code;
    this.code = code;
  }
}

function lowercaseKeys(object) {
  if (object) {
    return Object.fromEntries(
      Object.entries(object).map(([k, v]) => [k.toLowerCase(), v])
    );
  }
}
