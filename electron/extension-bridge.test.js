const test=require("node:test");
const assert=require("node:assert/strict");
const {ALLOWED_HOSTS,ExtensionBridge}=require("./ws-server");
test("bridge allows only supported platform hosts",()=>{
 assert.equal(ALLOWED_HOSTS.get("lichess.org"),"lichess");
 assert.equal(ALLOWED_HOSTS.get("www.chess.com"),"chesscom");
 assert.equal(ALLOWED_HOSTS.get("evil.example"),undefined);
});
test("bridge binds to loopback by default",()=>{
 const bridge=new ExtensionBridge();
 assert.equal(bridge.host,"127.0.0.1");
 assert.equal(bridge.port,27301);
});
