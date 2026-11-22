const BASE="https://api.chess.com/pub";
export class ChessComService{
 constructor({fetchImpl,userAgent="ChessistLocal/0.1 (public data client)"}={}){this.fetch=fetchImpl||(async(url,options)=>{const bridge=window.chessist?.platform?.chesscomGet;if(!bridge)return fetch(url,options);const path=new URL(url).pathname.slice(4);const result=await bridge(path);return {ok:result.ok,status:result.status,json:async()=>result.data};});this.userAgent=userAgent;this.cache=new Map();}
 async get(path){const key=BASE+path;const cached=this.cache.get(key);if(cached&&cached.until>Date.now())return cached.value;const r=await this.fetch(key,{headers:{Accept:"application/json","User-Agent":this.userAgent}});if(r.status===429)throw new Error("Chess.com API rate limited; retry later.");if(!r.ok)throw new Error("Chess.com API "+r.status);const value=await r.json();this.cache.set(key,{value,until:Date.now()+300000});return value;}
 getProfile(username){return this.get("/player/"+encodeURIComponent(username));}
 getRatings(username){return this.get("/player/"+encodeURIComponent(username)+"/stats");}
 async getRecentGames(username,{max=20}={}){const archives=await this.get("/player/"+encodeURIComponent(username)+"/games/archives");const result=[];for(const url of archives.archives.slice(-3).reverse()){const month=url.split("/").slice(-2).join("/");const data=await this.get("/player/"+encodeURIComponent(username)+"/games/"+month);result.push(...(data.games||[]).reverse());if(result.length>=max)break;}return result.slice(0,max);}
 async getGamePGN(username,year,month){const m=String(month).padStart(2,"0");const data=await this.get("/player/"+encodeURIComponent(username)+"/games/"+year+"/"+m);return (data.games||[]).map(g=>g.pgn||"").filter(Boolean).join("\n\n");}
}
