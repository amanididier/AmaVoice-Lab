import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

type AppState =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "error";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

interface LatencyMetrics {
  keyToRecordMs?: number;
  recordDurationMs?: number;
  endSpeechToTranscriptMs?: number;
  transcriptToFirstTokenMs?: number;
  firstTokenToFirstAudioMs?: number;
  totalTurnMs?: number;
}

function App() {
  const [state, setState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [metrics, setMetrics] = useState<LatencyMetrics | null>(null);
  const [geminiModel, setGeminiModel] = useState("gemini-2.0-flash");

  useEffect(() => {
    (async () => {
      try {
        const hasKey = await invoke<boolean>("has_gemini_key");
        setApiKeyConfigured(hasKey);
        const ready = await invoke<boolean>("models_ready");
        setModelsReady(ready);
      } catch (e) {
        console.warn("Status check failed (expected in early scaffold)", e);
      }
    })();
  }, []);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    (async () => {
      unsubs.push(await listen("state-changed", (e) => setState(e.payload as AppState)));
      unsubs.push(await listen("partial-transcript", (e) => setPartialTranscript(e.payload as string)));
      unsubs.push(
        await listen("final-transcript", (e) => {
          const text = e.payload as string;
          setPartialTranscript("");
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "user", text, timestamp: Date.now() },
          ]);
        })
      );
      unsubs.push(
        await listen("assistant-chunk", (e) => {
          const text = e.payload as string;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant") {
              return [...prev.slice(0, -1), { ...last, text: last.text + text }];
            }
            return [
              ...prev,
              { id: crypto.randomUUID(), role: "assistant", text, timestamp: Date.now() },
            ];
          });
        })
      );
      unsubs.push(
        await listen("error", (e) => {
          setError(e.payload as string);
          setState("error");
        })
      );
      unsubs.push(await listen("metrics", (e) => setMetrics(e.payload as LatencyMetrics)));
    })();
    return () => unsubs.forEach((u) => u());
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setPartialTranscript("");
    setError(null);
    invoke("clear_conversation").catch(console.error);
  }, []);

  const stopSpeaking = useCallback(() => {
    invoke("stop_speaking").catch(console.error);
  }, []);

  const stateLabel: Record<AppState, string> = {
    idle: "Ready — hold Caps Lock to talk",
    listening: "Listening…",
    transcribing: "Transcribing…",
    thinking: "Thinking…",
    speaking: "Speaking…",
    interrupted: "Interrupted",
    error: "Error",
  };

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo">A</span>
          <div>
            <h1>AmaVoice Lab</h1>
            <p className="tagline">Local STT · Gemini · Local TTS</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={() => setShowModels(true)}>Models</button>
          <button className="icon-btn" onClick={() => setShowSettings(true)}>Settings</button>
        </div>
      </header>

      <div className={`status-bar state-${state}`}>
        <div className="pulse" />
        <span>{stateLabel[state]}</span>
        {state === "speaking" && (
          <button className="stop-btn" onClick={stopSpeaking}>Stop</button>
        )}
      </div>

      {!apiKeyConfigured && (
        <div className="banner warning">
          Gemini API key not set. Open Settings and paste your free key from{" "}
          <a href="https://aistudio.google.com" target="_blank" rel="noreferrer">aistudio.google.com</a>.
        </div>
      )}

      {!modelsReady && (
        <div className="banner info">
          Speech models not installed yet. Open <strong>Models</strong> and download the recommended set (~150–200 MB).
        </div>
      )}

      {error && (
        <div className="banner error" onClick={() => setError(null)}>
          {error} (click to dismiss)
        </div>
      )}

      <main className="conversation">
        {messages.length === 0 && !partialTranscript && (
          <div className="empty">
            <p>Hold <kbd>Caps Lock</kbd> and speak.</p>
            <p className="hint">Release to send to Gemini. Speak again to interrupt.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>
            <div className="role">{m.role === "user" ? "You" : "AmaVoice"}</div>
            <div className="text">{m.text}</div>
          </div>
        ))}
        {partialTranscript && (
          <div className="bubble user partial">
            <div className="role">You (listening)</div>
            <div className="text">{partialTranscript}</div>
          </div>
        )}
      </main>

      <footer className="footer">
        <button className="secondary" onClick={clearConversation}>Clear</button>
        <div className="meta">
          {geminiModel} · {modelsReady ? "Models ready" : "Models pending"}
        </div>
        {metrics && (
          <div className="metrics" title="Last turn latency">
            E2E {metrics.totalTurnMs ?? "—"} ms
          </div>
        )}
      </footer>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onKeySaved={() => setApiKeyConfigured(true)}
          model={geminiModel}
          onModelChange={setGeminiModel}
        />
      )}

      {showModels && (
        <ModelsModal onClose={() => setShowModels(false)} onReady={() => setModelsReady(true)} />
      )}
    </div>
  );
}

function SettingsModal({
  onClose,
  onKeySaved,
  model,
  onModelChange,
}: {
  onClose: () => void;
  onKeySaved: () => void;
  model: string;
  onModelChange: (m: string) => void;
}) {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    setMsg("");
    try {
      await invoke("save_gemini_key", { key: key.trim() });
      setMsg("Saved securely.");
      onKeySaved();
      setKey("");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(false);
    }
  };

  const validate = async () => {
    setMsg("Validating…");
    try {
      await invoke("validate_gemini_key");
      setMsg("Key works.");
    } catch (e) {
      setMsg(String(e));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <label>
          Gemini API Key
          <input
            type="password"
            placeholder="Paste key from aistudio.google.com"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="row">
          <button onClick={save} disabled={saving || !key.trim()}>Save Key</button>
          <button className="secondary" onClick={validate}>Validate</button>
        </div>
        {msg && <p className="msg">{msg}</p>}
        <label>
          Model
          <select
            value={model}
            onChange={(e) => {
              onModelChange(e.target.value);
              invoke("set_gemini_model", { model: e.target.value }).catch(console.error);
            }}
          >
            <option value="gemini-2.0-flash">gemini-2.0-flash (recommended)</option>
            <option value="gemini-1.5-flash">gemini-1.5-flash</option>
            <option value="gemini-1.5-pro">gemini-1.5-pro</option>
            <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</option>
          </select>
        </label>
        <p className="hint">
          Key is stored with the OS credential manager / encrypted local storage.
        </p>
        <button className="secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function ModelsModal({ onClose, onReady }: { onClose: () => void; onReady: () => void }) {
  const [progress, setProgress] = useState("");
  const [downloading, setDownloading] = useState(false);

  const downloadRecommended = async () => {
    setDownloading(true);
    setProgress("Starting download…");
    try {
      await invoke("download_recommended_models");
      setProgress("Done. Models ready.");
      onReady();
    } catch (e) {
      setProgress(String(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Speech Models</h2>
        <p>Download the lightweight set optimized for 8 GB RAM / CPU-only:</p>
        <ul>
          <li><strong>STT</strong>: sherpa-onnx streaming Zipformer EN (~80 MB) or whisper.cpp tiny.en (~75 MB)</li>
          <li><strong>TTS</strong>: Kokoro 82M int8 ONNX (~85 MB)</li>
        </ul>
        <p className="hint">Models are stored in your AppData folder. Nothing is uploaded.</p>
        <button onClick={downloadRecommended} disabled={downloading}>
          {downloading ? "Downloading…" : "Download recommended set"}
        </button>
        {progress && <p className="msg">{progress}</p>}
        <button className="secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default App;
