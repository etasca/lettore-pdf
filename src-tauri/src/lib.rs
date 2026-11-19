use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager};

/// Solo file con estensione .pdf
fn is_pdf(p: &str) -> bool {
    p.to_lowercase().ends_with(".pdf")
}

/// I PDF passati come argomenti; i percorsi relativi vengono risolti rispetto a `cwd`.
fn pdf_args<I: IntoIterator<Item = String>>(args: I, cwd: Option<&Path>) -> Vec<String> {
    args.into_iter()
        .skip(1)
        .filter(|a| is_pdf(a))
        .map(|a| {
            let p = PathBuf::from(&a);
            match cwd {
                Some(dir) if p.is_relative() => dir.join(p).to_string_lossy().into_owned(),
                _ => a,
            }
        })
        .collect()
}

/// Legge un PDF dal disco e lo restituisce come byte grezzi (veloce anche per file grandi).
/// È "async" così la lettura di file grandi non blocca la finestra.
#[tauri::command]
async fn read_pdf(path: String) -> Result<tauri::ipc::Response, String> {
    if !is_pdf(&path) {
        return Err(format!("{}: non è un file PDF", path));
    }
    std::fs::read(&path)
        .map(tauri::ipc::Response::new)
        .map_err(|e| format!("{}: {}", path, e))
}

/// Decodifica un percorso passato come %XX (serve per lettere accentate e spazi).
fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() && b[i + 1].is_ascii_hexdigit() && b[i + 2].is_ascii_hexdigit() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Scrive il PDF modificato sul disco: prima in un file temporaneo, poi sostituisce l'originale.
/// Accetta solo percorsi .pdf e dati che iniziano davvero come un PDF.
#[tauri::command]
fn write_pdf(request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let path = request
        .headers()
        .get("x-path")
        .and_then(|v| v.to_str().ok())
        .map(percent_decode)
        .ok_or("percorso del file mancante")?;
    if !is_pdf(&path) {
        return Err(format!("{}: non è un file PDF", path));
    }
    let tauri::ipc::InvokeBody::Raw(data) = request.body() else {
        return Err("dati non validi".into());
    };
    if !data.starts_with(b"%PDF-") {
        return Err("i dati da salvare non sono un PDF".into());
    }
    let tmp = format!("{}.salvataggio.tmp", path);
    if let Err(e) = std::fs::write(&tmp, data) {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!("{}: {}", path, e));
    }
    std::fs::rename(&tmp, &path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("{}: {}", path, e)
    })
}

/// I PDF passati all'avvio (doppio clic su un file / "Apri con").
#[tauri::command]
fn startup_files() -> Vec<String> {
    pdf_args(std::env::args(), None)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Se l'app è già aperta, il nuovo PDF va in una scheda della finestra esistente
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let _ = app.emit("open-files", pdf_args(args, Some(Path::new(&cwd))));
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        // Ricorda dimensione e posizione della finestra
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![read_pdf, write_pdf, startup_files])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
