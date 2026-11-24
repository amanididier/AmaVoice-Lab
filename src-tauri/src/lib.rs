// AmaVoice Lab — Tauri backend
// Phase 1 scaffold: state machine, settings stubs, hotkey placeholder.
// Real STT / TTS / Gemini streaming will be wired in subsequent phases.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AppState {
    Idle,
    Listening,
    Transcribing,
    Thinking,
    Speaking,
    Interrupted,
    Error,
}

#[derive(Default)]
pub struct AppData {
    pub state: AppState,
    pub gemini_key: Option<String>,
    pub gemini_model: String,
    pub models_ready: bool,
}

impl Default for AppState {
    fn default() -> Self {
        AppState::Idle
    }
}

pub struct AppStateMutex(pub Mutex<AppData>);

fn emit_state(app: &AppHandle, state: AppState) {
    let _ = app.emit("state-changed", state);
}

#[tauri::command]
fn has_gemini_key(state: State<'_, AppStateMutex>) -> bool {
    let data = state.0.lock().unwrap();
    data.gemini_key.as_ref().map(|k| !k.is_empty()).unwrap_or(false)
}

#[tauri::command]
fn models_ready(state: State<'_, AppStateMutex>) -> bool {
    state.0.lock().unwrap().models_ready
}

#[tauri::command]
fn save_gemini_key(key: String, state: State<'_, AppStateMutex>) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("Key cannot be empty".into());
    }
    // TODO: store via Windows Credential Manager / keyring crate
    let mut data = state.0.lock().unwrap();
    data.gemini_key = Some(key.trim().to_string());
    Ok(())
}

#[tauri::command]
fn validate_gemini_key(state: State<'_, AppStateMutex>) -> Result<(), String> {
    let data = state.0.lock().unwrap();
    let key = data.gemini_key.as_ref().ok_or("No key saved")?;
    if key.len() < 20 {
        return Err("Key looks too short".into());
    }
    Ok(())
}

#[tauri::command]
fn set_gemini_model(model: String, state: State<'_, AppStateMutex>) {
    state.0.lock().unwrap().gemini_model = model;
}

#[tauri::command]
fn clear_conversation() {}

#[tauri::command]
fn stop_speaking(app: AppHandle, state: State<'_, AppStateMutex>) {
    let mut data = state.0.lock().unwrap();
    data.state = AppState::Idle;
    emit_state(&app, AppState::Idle);
}

#[tauri::command]
fn download_recommended_models(
    app: AppHandle,
    state: State<'_, AppStateMutex>,
) -> Result<(), String> {
    let mut data = state.0.lock().unwrap();
    data.models_ready = true;
    let _ = app.emit("models-progress", "Models marked ready (scaffold)");
    Ok(())
}

#[tauri::command]
fn simulate_listen_cycle(app: AppHandle, state: State<'_, AppStateMutex>) {
    let mut data = state.0.lock().unwrap();
    data.state = AppState::Listening;
    emit_state(&app, AppState::Listening);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppStateMutex(Mutex::new(AppData {
            gemini_model: "gemini-2.0-flash".into(),
            ..Default::default()
        })))
        .invoke_handler(tauri::generate_handler![
            has_gemini_key,
            models_ready,
            save_gemini_key,
            validate_gemini_key,
            set_gemini_model,
            clear_conversation,
            stop_speaking,
            download_recommended_models,
            simulate_listen_cycle,
        ])
        .setup(|app| {
            let _handle = app.handle().clone();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
