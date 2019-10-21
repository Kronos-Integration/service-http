import { SendEndpoint } from "@kronos-integration/endpoint";

export class SocketEndpoint extends SendEndpoint {
  constructor(name, owner, path) {
    super(name, owner, {
      createOpposite: true
    });

    Object.defineProperty(this, 'path', {
      value: path
    });
  }

  get socket() {
    return true;
  }

  matches(ws, url) {
    return url.path === this.path;
  }

  open(ws) {
    this.owner.trace({
      state: 'open',
      endpoint: this.identifier
    });
    this.opposite.receive = message => {
      return new Promise((fullfill, reject) => {
        this.owner.trace({
          message: 'send',
          endpoint: this.identifier,
          content: message
        });
        ws.send(JSON.stringify(message), error => {
          if (error) {
            reject(error);
          } else {
            fullfill();
          }
        });
      });
    };
  }

  close(ws) {
    this.owner.trace({
      state: 'close',
      endpoint: this.identifier
    });
    this.opposite.receive = undefined;
  }

  toJSON() {
    const json = super.toJSON();

    json.socket = true;

    for (const attr of ['path']) {
      if (this[attr] !== undefined) {
        json[attr] = this[attr];
      }
    }

    return json;
  }
}
