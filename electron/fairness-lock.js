const ACTIVE_STATUSES = new Set(["created", "started", "playing", "active"]);
const ALLOWED_ANALYSIS_CONTEXTS = new Set(["finished-review","analysis-board","local-bot-postgame","local-bot-casual","spectating"]);
class FairnessLock {
  constructor(){this.games=new Map();this.unverifiedPlatforms=new Set();}
  updateGame({platform,gameId,status,userIsParticipant}){
    if(!platform||!gameId)throw new TypeError("platform and gameId are required");
    const key=String(platform)+":"+String(gameId);
    if(!userIsParticipant||!ACTIVE_STATUSES.has(String(status||"").toLowerCase()))this.games.delete(key);
    else this.games.set(key,{platform:String(platform),gameId:String(gameId),status:String(status),userIsParticipant:true});
    return this.snapshot();
  }
  setMonitoring(platform,verified){
    if(!platform)throw new TypeError("platform is required");
    if(verified)this.unverifiedPlatforms.delete(String(platform));else this.unverifiedPlatforms.add(String(platform));
    return this.snapshot();
  }
  clearMonitoring(platform){this.unverifiedPlatforms.delete(String(platform));return this.snapshot();}
  isLocked(){return this.games.size>0||this.unverifiedPlatforms.size>0;}
  assertCanAnalyze(context){
    if(this.games.size>0){const error=new Error("Engine locked: you are participating in an active online game");error.code="ENGINE_LOCKED";throw error;}
    if(this.unverifiedPlatforms.size>0){const error=new Error("Engine paused: Chessist cannot verify your active game status on "+[...this.unverifiedPlatforms].join(", "));error.code="FAIRNESS_UNVERIFIED";throw error;}
    if(!ALLOWED_ANALYSIS_CONTEXTS.has(context)){const error=new Error("Engine analysis is not allowed in this game context");error.code="ENGINE_CONTEXT_DENIED";throw error;}
  }
  snapshot(){return {locked:this.isLocked(),reason:this.games.size?"Locked: game in progress":this.unverifiedPlatforms.size?"Paused: online game status could not be verified":null,activeGames:[...this.games.values()].map(({platform,gameId,status})=>({platform,gameId,status})),unverifiedPlatforms:[...this.unverifiedPlatforms]};}
  clearPlatform(platform){for(const [key,game] of this.games)if(game.platform===platform)this.games.delete(key);return this.snapshot();}
}
module.exports={FairnessLock,ACTIVE_STATUSES,ALLOWED_ANALYSIS_CONTEXTS};
