const BASE="https://lichess.org";
const SCOPES=["board:play","challenge:write","preference:read"];
const enc=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
async function pkce(){const bytes=crypto.getRandomValues(new Uint8Array(64));const verifier=enc(bytes);const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier));return {verifier,challenge:enc(digest)};}
export async function beginLichessOAuth({clientId,redirectUri="chessist://oauth/lichess"}){if(!clientId)throw new Error("Set your Lichess OAuth client ID in Settings.");const {verifier,challenge}=await pkce();const state=enc(crypto.getRandomValues(new Uint8Array(24)));sessionStorage.setItem("chessist:lichess:pkce",JSON.stringify({verifier,state,redirectUri}));const u=new URL("/oauth",BASE);u.searchParams.set("response_type","code");u.searchParams.set("client_id",clientId);u.searchParams.set("redirect_uri",redirectUri);u.searchParams.set("scope",SCOPES.join(" "));u.searchParams.set("code_challenge_method","S256");u.searchParams.set("code_challenge",challenge);u.searchParams.set("state",state);return u.toString();}
export async function finishLichessOAuth({code,state,clientId}){const raw=sessionStorage.getItem("chessist:lichess:pkce");if(!raw)throw new Error("OAuth session expired; try again.");const saved=JSON.parse(raw);if(saved.state!==state)throw new Error("OAuth state mismatch.");const api=window.chessist?.auth?.exchangeLichessToken;if(!api)throw new Error("Lichess OAuth token exchange is available only in the Chessist desktop app.");const token=await api({code,verifier:saved.verifier,clientId,redirectUri:saved.redirectUri});sessionStorage.removeItem("chessist:lichess:pkce");return token;}
export class LichessService{
 constructor({tokenProvider,fetchImpl=fetch}={}){this.tokenProvider=tokenProvider;this.fetch=fetchImpl;this.lastRequest=0;this.retryAfter=0;}
 async request(path,{method="GET",body,headers={}}={}){const wait=Math.max(0,this.retryAfter-Date.now(),this.lastRequest+100-Date.now());if(wait)await new Promise(r=>setTimeout(r,wait));this.lastRequest=Date.now();const token=await this.tokenProvider?.();const h={Accept:"application/json",...headers};if(token)h.Authorization="Bearer "+token;if(body instanceof URLSearchParams)h["Content-Type"]="application/x-www-form-urlencoded";const res=await this.fetch(BASE+path,{method,headers:h,body});if(res.status===429){this.retryAfter=Date.now()+60000;throw new Error("Lichess rate limit: retry in 60 seconds.");}if(!res.ok)throw new Error("Lichess API "+res.status+": "+(await res.text()).slice(0,180));return res;}
 async json(path,opts){return (await this.request(path,opts)).json();}
 getProfile(username){return this.json("/api/user/"+encodeURIComponent(username));}
 getRatings(username){return this.getProfile(username).then(p=>p.perfs||{});}
 async getRecentGames(username,{max=20}={}){const text=await (await this.request("/api/games/user/"+encodeURIComponent(username)+"?max="+max+"&moves=true",{headers:{Accept:"application/x-ndjson"}})).text();return text.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));}
 async getGamePGN(gameId){return (await this.request("/game/export/"+encodeURIComponent(gameId),{headers:{Accept:"application/x-chess-pgn"}})).text();}
 getCurrentGame(username){return this.json("/api/user/"+encodeURIComponent(username)+"/current-game");}
 getTvChannels(){return this.json("/api/tv/channels");}
 getTvGame(channel="best"){return this.json("/api/tv/"+encodeURIComponent(channel));}
 async seek({time=5,increment=3,rated=false,color="random",variant="standard"}={}){const b=new URLSearchParams({time:String(time),increment:String(increment),rated:String(rated),color,variant});return this.json("/api/board/seek",{method:"POST",body:b});}
 challengeFriend(username,{clock,rated=false,color="random"}={}){const b=new URLSearchParams({rated:String(rated),color});if(clock){b.set("clock.limit",String(clock.limit));b.set("clock.increment",String(clock.increment));}return this.json("/api/challenge/"+encodeURIComponent(username),{method:"POST",body:b});}
 challengeAI({level=3,color="random",clock}={}){const b=new URLSearchParams({level:String(level),color});if(clock){b.set("clock.limit",String(clock.limit));b.set("clock.increment",String(clock.increment));}return this.json("/api/challenge/ai",{method:"POST",body:b});}
 move(gameId,uci){return this.request("/api/board/game/"+encodeURIComponent(gameId)+"/move/"+encodeURIComponent(uci),{method:"POST"});}
 resign(gameId){return this.request("/api/board/game/"+encodeURIComponent(gameId)+"/resign",{method:"POST"});}
 abort(gameId){return this.request("/api/board/game/"+encodeURIComponent(gameId)+"/abort",{method:"POST"});}
 offerDraw(gameId){return this.request("/api/board/game/"+encodeURIComponent(gameId)+"/draw",{method:"POST"});}
 sendChat(gameId,room,text){return this.request("/api/board/game/"+encodeURIComponent(gameId)+"/chat",{method:"POST",body:new URLSearchParams({room,text})});}
 async *stream(path){const res=await this.request(path,{headers:{Accept:"application/x-ndjson"}});const reader=res.body.getReader();const decoder=new TextDecoder();let buf="";try{while(true){const {value,done}=await reader.read();if(done)break;buf+=decoder.decode(value,{stream:true});const lines=buf.split("\n");buf=lines.pop()||"";for(const line of lines){if(!line.trim())continue;try{yield JSON.parse(line);}catch{}}}}finally{reader.releaseLock();}}
 streamEvents(){return this.stream("/api/stream/event");}
 streamGame(gameId){return this.stream("/api/board/game/stream/"+encodeURIComponent(gameId));}
 streamPublicGame(gameId){return this.stream("/api/stream/game/"+encodeURIComponent(gameId));}
}