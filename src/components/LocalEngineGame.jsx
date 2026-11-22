import React,{useEffect,useRef,useState} from "react";
import {Chess} from "chess.js";
import Board from "./Board";
import {engine as berserkEngine} from "../services/engine";

export default function LocalEngineGame({fairness}){
 const [game,setGame]=useState(()=>new Chess());
 const [humanColor,setHumanColor]=useState("w");
 const [thinking,setThinking]=useState(false);
 const [status,setStatus]=useState("Choose your colour and start a local game.");
 const [strength,setStrength]=useState(1800);
 const [engineStatus,setEngineStatus]=useState({status:"idle",progress:0});
 const gameRef=useRef(game);
 const mounted=useRef(true);
 const update=next=>{gameRef.current=next;setGame(next);};
 useEffect(()=>{mounted.current=true;const off=berserkEngine.subscribe(setEngineStatus);return()=>{mounted.current=false;off();berserkEngine.stop();};},[]);
 useEffect(()=>{if(fairness?.locked){berserkEngine.stop();setThinking(false);setStatus("Local engine paused: finish your active online game first.");}},[fairness?.locked]);
 const runEngine=async position=>{
   if(fairness?.locked){setStatus("Engine locked during your active online game.");return;}
   setThinking(true);setStatus("Berserk is thinking…");
   try{
     const result=await berserkEngine.search(position.fen(),Math.max(250,Math.min(6000,Math.round(6000*strength/3500))),1,"local-bot-casual");
     if(!mounted.current)return;
     const uci=result.bestmove;
     if(!uci||uci==="(none)"||uci==="0000"){setStatus("Game over.");setThinking(false);return;}
     const next=new Chess(position.fen());
     next.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||"q"});
     update(next);setStatus(next.isGameOver()?"Game over.":next.isCheck()?"Check. Your move.":"Your move.");setThinking(false);
   }catch(error){if(mounted.current){setStatus(error.message||"Berserk search failed.");setThinking(false);}}
 };
 const move=(from,to)=>{
   if(thinking||fairness?.locked||gameRef.current.turn()!==humanColor)return;
   const next=new Chess(gameRef.current.fen());
   try{const played=next.move({from,to,promotion:"q"});if(!played)return;update(next);if(next.isGameOver()){setStatus("Game over.");return;}runEngine(next);}catch{}
 };
 const newGame=color=>{
   berserkEngine.stop();setHumanColor(color);const next=new Chess();update(next);setThinking(false);setStatus(color==="b"?"Berserk is making the first move…":"Your move.");
   if(color==="b")setTimeout(()=>runEngine(next),0);
 };
 return <div className="analysis-layout"><section className="board-column"><div className="analysis-toolbar"><span className="live-indicator"/> LOCAL GAME · BERSERK ENGINE <span className="toolbar-spacer"/><button onClick={()=>newGame(humanColor)}>New game</button></div><Board game={game} onMove={move} orientation={humanColor==="w"?"white":"black"} disabled={thinking||fairness?.locked||game.turn()!==humanColor}/><div className="board-controls"><button onClick={()=>newGame("w")}>Play White</button><button onClick={()=>newGame("b")}>Play Black</button><button onClick={()=>{const next=new Chess();next.loadPgn(game.pgn());next.undo();update(next);setStatus("Last move undone.");}}>Undo</button></div></section><aside className="analysis-side"><div className="panel-card"><div className="eyebrow">BERSERK WASM</div><h2>Play locally</h2><p className="helper-text">This is an offline-style local game against your Berserk engine. It does not make moves on Lichess or Chess.com.</p><div className="engine-name">Engine: {engineStatus.status}{engineStatus.status==="loading"?" · "+Math.round(engineStatus.progress*100)+"%":""}</div><label>Search time / strength <b>{strength}</b><input type="range" min="600" max="3500" step="100" value={strength} onChange={e=>setStrength(Number(e.target.value))}/></label><button className="primary-button full" onClick={()=>newGame(humanColor)} disabled={thinking}>Restart game</button><p className="helper-text">{status}</p>{fairness?.locked?<p className="error-text">Fair-play lock is active for your online game.</p>:null}</div><div className="panel-card"><div className="panel-title">Game position</div><p className="helper-text">{game.isCheckmate()?"Checkmate":game.isDraw()?"Draw":game.isCheck()?"Check":game.isGameOver()?"Game over":"In progress"}</p><p className="pv-text">{game.fen()}</p><button className="quiet-button full" onClick={()=>navigator.clipboard?.writeText(game.pgn())}>Copy PGN</button></div></aside></div>;
}
