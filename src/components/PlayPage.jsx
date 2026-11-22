import React,{useEffect,useRef,useState} from "react";
import {Chess} from "chess.js";
import Board from "./Board";
function fromUci(moves){const game=new Chess();for(const uci of String(moves||"").trim().split(/\s+/).filter(Boolean)){try{game.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||"q"});}catch{break;}}return game;}
export default function PlayPage(){
 const [minutes,setMinutes]=useState(5),[increment,setIncrement]=useState(3),[rated,setRated]=useState(false),[opponent,setOpponent]=useState("");
 const [gameId,setGameId]=useState(""),[game,setGame]=useState(()=>new Chess()),[side,setSide]=useState("white");
 const [status,setStatus]=useState("Connect Lichess in Settings to start."),[clock,setClock]=useState({white:null,black:null});
 const [chat,setChat]=useState([]),[chatText,setChatText]=useState("");
 const poll=useRef(null),active=useRef(""),sideRef=useRef("white"),accountId=useRef(null);
 const api=window.chessist?.lichess;
 const updateSide=value=>{sideRef.current=value;setSide(value);};
 const attach=async id=>{
   if(!id||active.current===id||!api)return;
   active.current=id;setGameId(id);setStatus("Joining Lichess game…");
   try{const account=await api.request({path:"/api/account"});accountId.current=account.id;await api.streamGame(id);setStatus("Game connected · you play "+sideRef.current);}
   catch(e){setStatus(e.message);active.current="";setGameId("");}
 };
 useEffect(()=>{
   if(!api)return;
   const off=api.onGameEvent(({gameId:id,event})=>{
     if(id!==active.current)return;
     const state=event.type==="gameFull"?event.state:event;
     if(event.type==="gameFull"){
       const me=accountId.current;
       const color=me&&event.white?.id===me?"white":me&&event.black?.id===me?"black":null;
       if(color)updateSide(color);
     }
     if(state?.moves!==undefined){setGame(fromUci(state.moves));setClock({white:state.wtime??null,black:state.btime??null});}
     if(state?.status&&state.status!=="started"&&state.status!=="created"){
       setStatus("Game finished · engine review unlocked");api.stopGameStream(id);active.current="";setGameId("");
     }
     if(event.type==="chatLine")setChat(v=>v.concat(event).slice(-50));
   });
   return ()=>{off();if(poll.current)clearInterval(poll.current);};
 },[]);
 const findActive=async()=>{try{const r=await api.request({path:"/api/account/playing"});const g=r.nowPlaying?.[0];if(g?.gameId)await attach(g.gameId);else if(!active.current)setStatus("Waiting for a Lichess game…");}catch(e){setStatus(e.message);}};
 const startPoll=()=>{if(poll.current)clearInterval(poll.current);findActive();poll.current=setInterval(findActive,2500);};
 const seek=async()=>{try{if(!api)throw new Error("Open this feature in the desktop app and connect Lichess.");setStatus("Searching for an opponent…");await api.request({path:"/api/board/seek",method:"POST",body:{time:String(minutes),increment:String(increment),rated:String(rated),variant:"standard",color:"random"}});startPoll();}catch(e){setStatus(e.message);}};
 const challenge=async ai=>{try{if(!api)throw new Error("Connect Lichess first.");setStatus(ai?"Creating AI challenge…":"Sending challenge…");const path=ai?"/api/challenge/ai":"/api/challenge/"+encodeURIComponent(opponent.trim());await api.request({path,method:"POST",body:ai?{level:"3",color:"random"}:{rated:String(rated),color:"random","clock.limit":String(minutes*60),"clock.increment":String(increment)}});startPoll();}catch(e){setStatus(e.message);}};
 const move=async(from,to)=>{
   if(!gameId||game.turn()!==(side==="white"?"w":"b")){setStatus("Wait for your turn.");return;}
   const next=new Chess(game.fen());
   try{const m=next.move({from,to,promotion:"q"});if(!m)return;await api.request({path:"/api/board/game/"+encodeURIComponent(gameId)+"/move/"+m.from+m.to+(m.promotion||""),method:"POST"});}
   catch(e){setStatus(e.message);}
 };
 const action=async name=>{if(!gameId)return;try{await api.request({path:"/api/board/game/"+encodeURIComponent(gameId)+"/"+name,method:"POST"});setStatus(name==="resign"?"Resigned":name==="abort"?"Game aborted":"Draw offered");}catch(e){setStatus(e.message);}};
 const sendChat=async()=>{if(!chatText.trim()||!gameId)return;try{await api.request({path:"/api/board/game/"+encodeURIComponent(gameId)+"/chat",method:"POST",body:{room:"player",text:chatText}});setChatText("");}catch(e){setStatus(e.message);}};
 return <div className="play-layout"><div className="play-main"><div className="play-toolbar"><span className="eyebrow">LICHESS BOARD API</span><span className="play-status">{status}</span></div><Board game={game} onMove={move} orientation={side} disabled={!gameId||game.turn()!==(side==="white"?"w":"b")}/><div className="play-clocks"><div>WHITE <b>{clock.white==null?"—":(clock.white/1000).toFixed(1)+"s"}</b></div><div>BLACK <b>{clock.black==null?"—":(clock.black/1000).toFixed(1)+"s"}</b></div></div>{gameId?<div className="play-actions"><button onClick={()=>action("resign")}>Resign</button><button onClick={()=>action("draw")}>Offer draw</button><button onClick={()=>action("abort")}>Abort</button></div>:null}</div><aside className="play-side"><div className="panel-card"><div className="panel-title">Quick pairing</div><label>Minutes<input type="number" min="1" max="180" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label><label>Increment (seconds)<input type="number" min="0" max="60" value={increment} onChange={e=>setIncrement(Number(e.target.value))}/></label><label className="check-label"><input type="checkbox" checked={rated} onChange={e=>setRated(e.target.checked)}/> Rated game</label><button className="primary-button full" onClick={seek}>Find opponent</button></div><div className="panel-card"><div className="panel-title">Challenge</div><input placeholder="Lichess username" value={opponent} onChange={e=>setOpponent(e.target.value)}/><button className="primary-button full" disabled={!opponent.trim()} onClick={()=>challenge(false)}>Challenge player</button><button className="quiet-button full" onClick={()=>challenge(true)}>Play Lichess AI</button></div><div className="panel-card"><div className="panel-title">Chess.com</div><p className="helper-text">Chess.com does not provide a public API for submitting moves in human games. Open its official playing interface to sign in and play there.</p><button className="primary-button full" onClick={()=>window.chessist?.platform?.openChessCom?.()}>Open Chess.com Play</button></div><div className="panel-card"><div className="panel-title">Game chat</div><div className="chat-log">{chat.map((m,i)=><div key={i}><b>{m.username||"Opponent"}:</b> {m.text}</div>)}</div><div className="chat-send"><input value={chatText} onChange={e=>setChatText(e.target.value)} placeholder="Message…"/><button onClick={sendChat}>Send</button></div></div></aside></div>;
}