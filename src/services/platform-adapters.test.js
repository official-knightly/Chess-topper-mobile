import {describe,it,expect,vi} from "vitest";
import {LichessService} from "./lichess";
import {ChessComService} from "./chesscom";
import {WorldChessService} from "./worldchess";
import {createPlatformAdapter} from "./platform";
describe("platform adapters",()=>{
 it("normalizes the shared platform interface",async()=>{const fake={getProfile:async()=>({name:"player"}),getRatings:async()=>({blitz:{rating:1800}}),getRecentGames:async()=>[],getGamePGN:async()=>"1. e4"};const adapter=createPlatformAdapter(fake);expect(await adapter.getProfile("x")).toEqual({name:"player"});expect(await adapter.getGamePGN("x","id")).toBe("1. e4");});
 it("rejects adapters missing a required method",()=>{expect(()=>createPlatformAdapter({getProfile(){}})).toThrow("getRatings");});
 it("parses Lichess NDJSON game exports",async()=>{const fetchImpl=vi.fn().mockResolvedValue(new Response('{"id":"one"}\n{"id":"two"}\n',{status:200}));const service=new LichessService({fetchImpl});expect(await service.getRecentGames("player")).toEqual([{id:"one"},{id:"two"}]);});
 it("backs off for 60 seconds after a Lichess 429",async()=>{const fetchImpl=vi.fn().mockResolvedValue(new Response("",{status:429}));const service=new LichessService({fetchImpl});await expect(service.getProfile("x")).rejects.toThrow("60 seconds");expect(service.retryAfter).toBeGreaterThan(Date.now()+59000);});
 it("uses Chess.com published profile endpoint and caches the response",async()=>{const fetchImpl=vi.fn().mockResolvedValue(new Response(JSON.stringify({username:"player"}),{status:200,headers:{"Content-Type":"application/json"}}));const service=new ChessComService({fetchImpl});await service.getProfile("player");await service.getProfile("player");expect(fetchImpl).toHaveBeenCalledTimes(1);expect(fetchImpl.mock.calls[0][0]).toContain("/player/player");});
 it("resolves World Chess profile IDs to official public profile links without inventing API data",async()=>{const service=new WorldChessService();const profile=await service.getProfile("https://worldchess.com/profile/1232722");expect(profile.profileUrl).toBe("https://worldchess.com/profile/1232722");expect((await service.getRatings("1232722")).externalOnly).toBe(true);expect(await service.getRecentGames("1232722")).toEqual([]);await expect(service.getProfile("not-a-profile")).rejects.toThrow("numeric World Chess profile ID");});
});
