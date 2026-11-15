use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, RunEvent, Runtime};
use tauri_plugin_fs::FsExt;

/// Paths handed to the app before the frontend was ready to listen
/// (Finder "Open With", double-click, CLI args). The UI drains this once on boot.
#[derive(Default)]
struct Pending(Mutex<Vec<String>>);

const MD_EXT: [&str; 4] = ["md", "markdown", "mdown", "mkd"];

fn is_markdown(p: &Path) -> bool {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| MD_EXT.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// Grant read access to a file's folder (or a folder itself) so relative images
/// and sibling documents resolve. Called for OS-provided paths, which the dialog
/// plugin never saw and therefore never scoped.
fn grant<R: Runtime>(app: &AppHandle<R>, path: &Path) {
    let dir: PathBuf = if path.is_dir() {
        path.to_path_buf()
    } else {
        path.parent().map(Path::to_path_buf).unwrap_or_else(|| path.to_path_buf())
    };
    let _ = app.fs_scope().allow_directory(&dir, true);
    let _ = app.asset_protocol_scope().allow_directory(&dir, true);
}

fn accept_paths<R: Runtime>(app: &AppHandle<R>, raw: impl IntoIterator<Item = PathBuf>) -> Vec<String> {
    raw.into_iter()
        .filter(|p| p.is_dir() || is_markdown(p))
        .map(|p| {
            grant(app, &p);
            p.to_string_lossy().into_owned()
        })
        .collect()
}

fn deliver<R: Runtime>(app: &AppHandle<R>, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    app.state::<Pending>().0.lock().unwrap().extend(paths.clone());
    let _ = app.emit("open-paths", paths);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[tauri::command]
fn take_pending_paths(state: tauri::State<Pending>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

/// A file the user already has access to (picked via dialog / restored scope)
/// gets its containing folder authorized too, so relative assets render.
#[tauri::command]
fn authorize_siblings(app: AppHandle, path: String) -> bool {
    let p = PathBuf::from(&path);
    if app.fs_scope().is_allowed(&p) {
        grant(&app, &p);
        true
    } else {
        false
    }
}

#[tauri::command]
fn set_locale(app: AppHandle, locale: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let menu = menu::build(&app, &locale).map_err(|e| e.to_string())?;
        app.set_menu(menu).map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, locale);
    Ok(())
}

#[cfg(target_os = "macos")]
mod menu {
    use tauri::menu::{AboutMetadata, Menu, MenuItemBuilder, SubmenuBuilder};
    use tauri::{AppHandle, Runtime};

    fn tr(loc: &str, key: &str) -> &'static str {
        let ar = loc.starts_with("ar");
        match (key, ar) {
            ("about", true) => "حول قارئ",
            ("about", false) => "About Qari",
            ("settings", true) => "الإعدادات…",
            ("settings", false) => "Settings…",
            ("services", true) => "الخدمات",
            ("services", false) => "Services",
            ("hide", true) => "إخفاء قارئ",
            ("hide", false) => "Hide Qari",
            ("hide_others", true) => "إخفاء الآخرين",
            ("hide_others", false) => "Hide Others",
            ("show_all", true) => "إظهار الكل",
            ("show_all", false) => "Show All",
            ("quit", true) => "إنهاء قارئ",
            ("quit", false) => "Quit Qari",
            ("file", true) => "ملف",
            ("file", false) => "File",
            ("open_file", true) => "فتح ملف…",
            ("open_file", false) => "Open File…",
            ("open_folder", true) => "فتح مجلد…",
            ("open_folder", false) => "Open Folder…",
            ("open_url", true) => "فتح رابط…",
            ("open_url", false) => "Open URL…",
            ("quick_open", true) => "فتح سريع…",
            ("quick_open", false) => "Quick Open…",
            ("close", true) => "إغلاق النافذة",
            ("close", false) => "Close Window",
            ("edit", true) => "تحرير",
            ("edit", false) => "Edit",
            ("undo", true) => "تراجع",
            ("undo", false) => "Undo",
            ("redo", true) => "إعادة",
            ("redo", false) => "Redo",
            ("cut", true) => "قص",
            ("cut", false) => "Cut",
            ("copy", true) => "نسخ",
            ("copy", false) => "Copy",
            ("paste", true) => "لصق",
            ("paste", false) => "Paste",
            ("select_all", true) => "تحديد الكل",
            ("select_all", false) => "Select All",
            ("find", true) => "بحث في المستند…",
            ("find", false) => "Find in Document…",
            ("view", true) => "عرض",
            ("view", false) => "View",
            ("zoom_in", true) => "تكبير النص",
            ("zoom_in", false) => "Bigger Text",
            ("zoom_out", true) => "تصغير النص",
            ("zoom_out", false) => "Smaller Text",
            ("zoom_reset", true) => "الحجم الافتراضي",
            ("zoom_reset", false) => "Default Size",
            ("outline", true) => "المحتويات",
            ("outline", false) => "Outline",
            ("focus", true) => "وضع التركيز",
            ("focus", false) => "Focus Mode",
            ("toggle_lang", true) => "English Interface",
            ("toggle_lang", false) => "الواجهة العربية",
            ("fullscreen", true) => "ملء الشاشة",
            ("fullscreen", false) => "Enter Full Screen",
            ("go", true) => "انتقال",
            ("go", false) => "Go",
            ("prev", true) => "الملف السابق",
            ("prev", false) => "Previous File",
            ("next", true) => "الملف التالي",
            ("next", false) => "Next File",
            ("window", true) => "نافذة",
            ("window", false) => "Window",
            ("minimize", true) => "تصغير",
            ("minimize", false) => "Minimize",
            ("zoom", true) => "تكبير/تصغير",
            ("zoom", false) => "Zoom",
            _ => "",
        }
    }

    pub fn build<R: Runtime>(app: &AppHandle<R>, loc: &str) -> tauri::Result<Menu<R>> {
        let t = |k| tr(loc, k);
        let item = |id: &str, key: &str, accel: &str| {
            MenuItemBuilder::with_id(id, tr(loc, key)).accelerator(accel).build(app)
        };

        let app_menu = SubmenuBuilder::new(app, "Qari")
            .about_with_text(t("about"), Some(AboutMetadata::default()))
            .separator()
            .item(&item("settings", "settings", "CmdOrCtrl+,")?)
            .separator()
            .services_with_text(t("services"))
            .separator()
            .hide_with_text(t("hide"))
            .hide_others_with_text(t("hide_others"))
            .show_all_with_text(t("show_all"))
            .separator()
            .quit_with_text(t("quit"))
            .build()?;

        let file = SubmenuBuilder::new(app, t("file"))
            .item(&item("open_file", "open_file", "CmdOrCtrl+O")?)
            .item(&item("open_folder", "open_folder", "CmdOrCtrl+Shift+O")?)
            .item(&item("open_url", "open_url", "CmdOrCtrl+L")?)
            .item(&item("quick_open", "quick_open", "CmdOrCtrl+P")?)
            .separator()
            .close_window_with_text(t("close"))
            .build()?;

        let edit = SubmenuBuilder::new(app, t("edit"))
            .undo_with_text(t("undo"))
            .redo_with_text(t("redo"))
            .separator()
            .cut_with_text(t("cut"))
            .copy_with_text(t("copy"))
            .paste_with_text(t("paste"))
            .select_all_with_text(t("select_all"))
            .separator()
            .item(&item("find", "find", "CmdOrCtrl+F")?)
            .build()?;

        let view = SubmenuBuilder::new(app, t("view"))
            .item(&item("zoom_in", "zoom_in", "CmdOrCtrl+=")?)
            .item(&item("zoom_out", "zoom_out", "CmdOrCtrl+-")?)
            .item(&item("zoom_reset", "zoom_reset", "CmdOrCtrl+0")?)
            .separator()
            .item(&item("outline", "outline", "CmdOrCtrl+Shift+T")?)
            .item(&item("focus", "focus", "CmdOrCtrl+.")?)
            .separator()
            .item(&item("toggle_lang", "toggle_lang", "CmdOrCtrl+Shift+L")?)
            .separator()
            .fullscreen_with_text(t("fullscreen"))
            .build()?;

        let go = SubmenuBuilder::new(app, t("go"))
            .item(&item("prev", "prev", "CmdOrCtrl+[")?)
            .item(&item("next", "next", "CmdOrCtrl+]")?)
            .build()?;

        let window = SubmenuBuilder::new(app, t("window"))
            .minimize_with_text(t("minimize"))
            .maximize_with_text(t("zoom"))
            .build()?;

        Menu::with_items(app, &[&app_menu, &file, &edit, &view, &go, &window])
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    #[cfg(any(windows, target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let paths = accept_paths(app, argv.into_iter().skip(1).map(PathBuf::from));
            deliver(app, paths);
        }));
    }

    builder = builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        // No-op on Windows/Linux; real NSGlassEffectView on macOS 26+, NSVisualEffectView before.
        .plugin(tauri_plugin_liquid_glass::init());

    builder
        .manage(Pending::default())
        .setup(|app| {
            let handle = app.handle().clone();
            #[cfg(any(windows, target_os = "linux"))]
            {
                let paths = accept_paths(&handle, std::env::args().skip(1).map(PathBuf::from));
                handle.state::<Pending>().0.lock().unwrap().extend(paths);
            }
            #[cfg(target_os = "macos")]
            {
                let m = menu::build(&handle, "ar")?;
                app.set_menu(m)?;
            }
            let _ = handle;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Dropped paths come from the OS, so they're trusted: scope them here rather than from JS.
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                let app = window.app_handle();
                let accepted = accept_paths(app, paths.clone());
                deliver(app, accepted);
            }
        })
        .on_menu_event(|app, event| {
            let _ = app.emit("menu", event.id().0.as_str());
        })
        .invoke_handler(tauri::generate_handler![
            take_pending_paths,
            authorize_siblings,
            set_locale
        ])
        .build(tauri::generate_context!())
        .expect("error while building Qari")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let RunEvent::Opened { urls } = _event {
                let files = urls.into_iter().filter_map(|u| u.to_file_path().ok());
                let paths = accept_paths(_app, files);
                deliver(_app, paths);
            }
        });
}
