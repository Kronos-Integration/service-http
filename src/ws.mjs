import { Service } from "@kronos-integration/service";

export class ServiceWS extends Service
{
    constructor(config, owner) {
        super(config, owner);
    
        Object.defineProperties(this, {
          socketEndpoints: { value: {} }
        });
    }


    addSocketEndpoint(ep) {
        //this.addEndpoint(new SocketEndpoint(name, this));
        this.socketEndpoints[ep.path] = ep;
        return ep;
      }
    
      removeSocketEndpoint(ep) {
        delete this.socketEndpoints[ep.path];
      }
    
      createSocketEndpoint(name, path) {
        const thePath = path || name;
    
        let ep = this.socketEndpoints[thePath];
        if (ep === undefined) {
          ep = this.addSocketEndpoint(new SocketEndpoint(name, this, path));
        }
        return ep;
      }
    
      endpointForSocketConnection(ws, req) {
        const location = url.parse(req.url, true);
        return this.socketEndpoints[location.path];
        // you might use location.query.access_token to authenticate or share sessions
        // or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)
      }
    
    
}