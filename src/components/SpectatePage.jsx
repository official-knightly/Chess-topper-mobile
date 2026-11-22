import React, { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import Board from "./Board";
import { engine as berserkEngine } from "../services/engine";

function buildGame(moves, fen) {
  if (!moves && fen) {
    try { return new Chess(fen); } catch {}
  }
  const game = new Chess();
  for (const uci of (moves || "").trim().split(/\s+/).filter(Boolean)) {
    try { game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || "q" }); }
    catch { break; }
  }
  return game;
}

export default function SpectatePage({ fairness }) {
  const [username, setUsername] = useState("");
  const [gameId, setGameId] = useState("");
  const [game, setGame] = useState(() => new Chess());
  const [status, setStatus] = useState("Search a Lichess username or choose a TV game.");
  const [channels, setChannels] = useState([]);
  const [best, setBest] = useState("");
  const [pv, setPv] = useState("");
  const [depth, setDepth] = useState(18);
  const [info, setInfo] = useState(null);
  const [engineType, setEngineType] = useState("berserk");
  const [engineStatus, setEngineStatus] = useState({ status: "idle", progress: 0 });
  const [engineName, setEngineName] = useState("Berserk WASM");
  const controller = useRef(null);
  const api = window.chessist;
  const canUseBerserk = Boolean(api?.engine?.authorize);

  useEffect(() => {
    const off = api?.engine.onInfo(x => {
      setInfo(x);
      if (x.pv?.length) {
        setBest(x.pv[0]);
        setPv(x.pv.slice(0, 8).join(" "));
      }
    });
    const offBerserk = berserkEngine.subscribe(setEngineStatus);
    fetch("https://lichess.org/api/tv/channels")
      .then(r => r.json())
      .then(x => setChannels(Object.keys(x || {})))
      .catch(() => {});
    return () => {
      off?.();
      offBerserk();
      controller.current?.abort();
      berserkEngine.stop();
    };
  }, []);

  useEffect(() => {
    if (fairness?.locked) {
      berserkEngine.stop();
      setBest("");
      setPv("");
      setInfo(null);
      setStatus("Engine locked: you are playing an active online game.");
    }
  }, [fairness?.locked]);

  const watch = async id => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setGameId(id);
    setBest("");
    setPv("");
    setInfo(null);
    setStatus("Connecting to live game " + id + "…");
    try {
      const response = await fetch("https://lichess.org/api/stream/game/" + encodeURIComponent(id), {
        headers: { Accept: "application/x-ndjson" }, signal: c.signal
      });
      if (!response.ok) throw new Error("Public game stream unavailable (" + response.status + ")");
      setStatus("Watching live · " + id);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        buffer += decoder.decode(part.value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            setGame(buildGame(event.moves, event.fen));
            if (event.status && event.status !== "started") setStatus("Game finished · review available");
          } catch {}
        }
      }
      reader.releaseLock();
    } catch (error) {
      if (error.name !== "AbortError") setStatus(error.message);
    }
  };

  const find = async () => {
    try {
      setStatus("Looking up current game…");
      const response = await fetch("https://lichess.org/api/user/" + encodeURIComponent(username.trim()) + "/current-game");
      if (response.status === 404) throw new Error("No active public game found for this username.");
      if (!response.ok) throw new Error("Lichess returned " + response.status);
      const data = await response.json();
      await watch(data.id || data.gameId);
    } catch (error) { setStatus(error.message); }
  };

  const tv = async channel => {
    try {
      const response = await fetch("https://lichess.org/api/tv/" + encodeURIComponent(channel));
      if (!response.ok) throw new Error("TV channel unavailable");
      const data = await response.json();
      await watch(data.game?.id || data.id);
    } catch (error) { setStatus(error.message); }
  };

  const switchEngine = value => {
    if (value !== "berserk") berserkEngine.stop();
    setEngineType(value);
    setBest("");
    setPv("");
    setInfo(null);
    setStatus(value === "berserk" ? "Berserk WASM selected." : "Native UCI engine selected.");
  };

  const analyse = async () => {
    if (fairness?.locked) {
      setStatus("Engine locked: you are playing an active online game.");
      return;
    }
    if (!gameId) return;
    try {
      if (engineType === "berserk") {
        const result = await berserkEngine.search(game.fen(), Math.max(1000, Math.min(10000, depth * 250)), 3, "spectating");
        const candidate = result.candidates?.[0];
        const move = candidate?.uci || result.bestmove;
        setBest(move && move !== "(none)" && move !== "0000" ? move : "");
        setPv(candidate?.pv?.slice(0, 10).join(" ") || move || "");
        setInfo({ depth: result.depth, score: { type: "cp", value: result.scoreCp }, nps: null });
        setStatus("Berserk finished analysing this spectator position.");
      } else {
        await api.engine.start();
        await api.engine.analyze({ fen: game.fen(), depth, context: "spectating" });
        setStatus("Stockfish analysing the spectator position…");
      }
    } catch (error) { setStatus(error.message); }
  };

  const choose = async () => {
    try {
      const result = await api.engine.choose();
      if (result.ready) {
        setEngineName(result.path.split(/[\\\\/]/).pop());
        setStatus("Native engine switched successfully.");
      }
    } catch (error) { setStatus(error.message); }
  };

  return (
    <div className="spectate-layout">
      <section className="spectate-main">
        <div className="spectate-search">
          <div className="eyebrow">LIVE GAMES · LICHESS PUBLIC API</div>
          <div className="search-row">
            <input value={username} onChange={event => setUsername(event.target.value)} onKeyDown={event => event.key === "Enter" && find()} placeholder="Enter a Lichess username" />
            <button className="primary-button" onClick={find} disabled={!username.trim()}>Watch player</button>
          </div>
          <div className="tv-channels"><span>TV channels</span>{channels.slice(0, 8).map(channel => <button key={channel} onClick={() => tv(channel)}>{channel}</button>)}</div>
        </div>
        <Board game={game} onMove={() => {}} arrow={Boolean(best)} bestMove={best} />
        <div className="spectate-status">{status}</div>
      </section>
      <aside className="spectate-side">
        <div className="panel-card">
          <div className="panel-title">Engine analysis</div>
          <label>Engine
            <select value={engineType} onChange={event => switchEngine(event.target.value)}>
              <option value="stockfish">Native Stockfish / UCI</option>
              <option value="berserk" disabled={!canUseBerserk}>Berserk WASM (your engine)</option>
            </select>
          </label>
          {engineType === "stockfish" ? <>
            <div className="engine-name">{engineName}</div>
            <button className="quiet-button full" onClick={choose}>Switch native engine…</button>
          </> : <div className="engine-name">Berserk · {engineStatus.status}{engineStatus.status === "loading" ? " · " + Math.round(engineStatus.progress * 100) + "%" : ""}</div>}
          <label>Search strength: {depth}<input type="range" min="8" max="30" value={depth} onChange={event => setDepth(Number(event.target.value))} /></label>
          <button className="primary-button full" disabled={fairness?.locked || !gameId || (engineType === "berserk" && !canUseBerserk)} onClick={analyse}>Analyse position</button>
          <div className="spectate-eval">Evaluation: {info?.score ? (info.score.type === "mate" ? "M" : (info.score.value / 100).toFixed(2)) : "—"}</div>
          <div className="pv-text">{pv || "Best move and principal variation will appear here."}</div>
          <p className="helper-text">Best move is shown with an arrow on the spectator board. Analysis is unavailable while your account is playing.</p>
        </div>
        <div className="panel-card">
          <div className="panel-title">Fair-play status</div>
          <p className="helper-text">{fairness?.locked ? "Locked while you are a participant in an active game." : "Spectator analysis is permitted for games between other players."}</p>
        </div>
      </aside>
    </div>
  );
}
