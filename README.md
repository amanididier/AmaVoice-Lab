# AmaVoice Lab

**Lightweight, real-time, Siri-like AI voice assistant for Windows 11**

Speak → Local STT → Gemini → Local TTS → Hear the answer.

- **Push-to-talk** with Caps Lock (hold to talk, release to send)
- Fully local speech recognition & synthesis (no paid STT/TTS)
- Gemini for intelligence (your own free API key)
- Tauri 2 + React + TypeScript + Rust
- Optimized for 8 GB RAM / CPU-only

Repository: https://github.com/amanididier/AmaVoice-Lab

---

## Quick Start (Windows 11)

### 1. Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Rust](https://rustup.rs/) (stable)
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (for Tauri)
- WebView2 (usually already on Windows 11)

```bash
# Install Rust if needed
winget install Rustlang.Rustup
```

### 2. Clone & Install

```bash
git clone https://github.com/amanididier/AmaVoice-Lab.git
cd AmaVoice-Lab
npm install
```

### 3. Run in development

```bash
npm run tauri dev
```

First run will compile the Rust backend (several minutes).

### 4. Configure Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/) → Get API key (free).
2. In the app: open **Settings** → paste your key → Save.
3. Recommended model: `gemini-2.0-flash` or `gemini-1.5-flash` (fast & cheap).

The key is stored securely. Never committed.

### 5. Download Speech Models (First Run)

The installer is small. Models download on demand into `%APPDATA%/AmaVoice Lab/models/`.

**Recommended lightweight set (CPU-friendly):**

| Purpose | Model | Size | Notes |
|---------|-------|------|-------|
| STT (primary) | sherpa-onnx streaming Zipformer EN | ~60–100 MB | True streaming, low latency |
| STT (fallback) | whisper.cpp tiny.en | ~75 MB | Simple & reliable |
| TTS (primary) | Kokoro 82M int8 ONNX | ~80–90 MB | Natural English voice |

In the app go to **Models** → Download recommended set.

### 6. Use it

1. Hold **Caps Lock** → speak naturally.
2. Release → local STT produces transcript → sent to Gemini automatically.
3. Gemini streams reply → local TTS speaks it.
4. Press Caps Lock again while speaking to **interrupt** (barge-in).
5. Escape cancels current recording.

---

## Architecture (Practical Choices)

| Layer | Choice | Why |
|-------|--------|-----|
| Desktop shell | Tauri 2 | Small binary, native, no Electron |
| Frontend | React + TypeScript + Vite | Fast UI iteration |
| Audio capture | CPAL | Cross-platform, reliable on Windows |
| STT | sherpa-onnx (streaming Zipformer) + whisper.cpp fallback | True streaming + proven fallback |
| VAD | Silero / sherpa-onnx VAD | Reliable end-of-turn |
| TTS | Kokoro ONNX (int8) | Best quality/size on CPU |
| LLM | Google GenAI (Gemini) via official SDK | Streaming, cheap flash models |
| Hotkey | Tauri global-shortcut + Windows hook fallback | Hold/release + suppress Caps Lock toggle |
| Storage | SQLite (optional history) + OS credential store | Simple, private |

Models are **never** bundled in the installer. They download only when you choose them.

---

## Development Phases (Status)

- [x] **Phase 1** – Tauri scaffold + UI shell + basic state machine (Idle / Listening / …)
- [ ] **Phase 2** – Local STT (sherpa-onnx streaming + whisper fallback) + VAD
- [ ] **Phase 3** – Gemini streaming + conversation history
- [ ] **Phase 4** – Local TTS (Kokoro) + sentence chunking + playback queue
- [ ] **Phase 5** – Barge-in, continuous mode (experimental), latency instrumentation
- [ ] **Phase 6** – 8 GB RAM optimization, low-memory mode
- [ ] **Phase 7** – Windows installer + GitHub Actions release

Current focus: get a complete push-to-talk → Gemini → speak loop working with the lightest reliable models.

---

## Building the Installer

```bash
npm run tauri build
```

Produces a small `.exe` under `src-tauri/target/release/bundle/`.

---

## License

MIT (application code).  
Individual speech models have their own licenses (Apache-2.0 / MIT for the recommended ones).
