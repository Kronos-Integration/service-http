export class TestContext {
  constructor(options = {}) {
    this.headers = {};

    this.res = {
      setHeader: (k, v) => {
        this.headers[k] = v;
      },
      writeHead: (c, h) => {
        this.code = c;
        this.headers = h;
      },
      end: (arg) => {
        this.end = arg;
      }
    };

    this.req = {
      headers: { ...options.headers }
    };
  }
  throw(code) {
    this.raisedError = code;
  }
}
