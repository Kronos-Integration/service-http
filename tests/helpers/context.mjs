export class TestContext {
  constructor() {

    this.headers = {};
    
    this.res = {
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
    };

    this.req = {
      headers: {}
    };
  }
  throw(code) {
    raisedError = code;
  }
}
