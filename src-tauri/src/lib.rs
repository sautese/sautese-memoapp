use std::fs;
use tauri::path::BaseDirectory;
use tauri::Manager;

use tauri_plugin_global_shortcut::{
    Code,
    GlobalShortcutExt,
    Modifiers,
    Shortcut,
    ShortcutState
};

#[tauri::command]
fn save_memo(
    app: tauri::AppHandle,
    content: String
) -> Result<(), String> {

    let path = app
        .path()
        .resolve(
            "memo.json",
            BaseDirectory::AppData
        )
        .map_err(|e| e.to_string())?;

    if let Some(parent) = path.parent() {

        fs::create_dir_all(parent)
            .map_err(|e| e.to_string())?;
    }

    fs::write(
        path,
        content
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn load_memo(
    app: tauri::AppHandle
) -> Result<String, String> {

    let path = app
        .path()
        .resolve(
            "memo.json",
            BaseDirectory::AppData
        )
        .map_err(|e| e.to_string())?;

    if !path.exists() {

        return Ok(
            r#"{
                "currentDate":"",
                "data":{}
            }"#.to_string()
        );
    }

    let content =
        fs::read_to_string(path)
            .map_err(|e| e.to_string())?;

    Ok(content)
}

#[cfg_attr(
    mobile,
    tauri::mobile_entry_point
)]
pub fn run() {

    tauri::Builder::default()
    .plugin(
        tauri_plugin_opener::init()
    )

        .plugin(
            tauri_plugin_opener::init()
        )

        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .build()
        )

        .setup(|app| {

            let window =
         app.get_webview_window("main")
                .unwrap();

            // ======================
            // 右上角定位
            // ======================
            if let Some(monitor) = window.current_monitor().unwrap() {

                let size = monitor.size();

                let window_size = window.outer_size().unwrap();

                let margin_right = 5;
                let margin_top = 75;

                let x = size.width as i32 - window_size.width as i32 - margin_right;
                let y = margin_top;

                let _ = window.set_position(
                    tauri::PhysicalPosition::new(x, y)
                );
            }

            let _ =
                window.show();

            let handle =
                app.handle().clone();

            let gs =
                app.global_shortcut();

            // ======================
            // Ctrl+1
            // ======================

            let _ =
                gs.on_shortcut(
                    Shortcut::new(
                        Some(
                            Modifiers::CONTROL
                        ),
                        Code::Digit1
                    ),

                    move |_app, _shortcut, event| {

                        if event.state
                            == ShortcutState::Pressed
                        {

                            let win =
                                handle
                                    .get_webview_window("main")
                                    .unwrap();

                            if win
                                .is_visible()
                                .unwrap_or(false)
                            {

                                let _ =
                                    win.hide();

                            } else {

                                let _ =
                                    win.show();

                                let _ =
                                    win.set_focus();
                            }
                        }
                    }
                );

            // ======================
            // Ctrl+2
            // ======================

            let handle2 =
                app.handle().clone();

            let _ =
                gs.on_shortcut(
                    Shortcut::new(
                        Some(
                            Modifiers::CONTROL
                        ),
                        Code::Digit2
                    ),

                    move |_app, _shortcut, event| {

                        if event.state
                            == ShortcutState::Pressed
                        {

                            let win =
                                handle2
                                    .get_webview_window("main")
                                    .unwrap();

                            let _ =
                                win.eval(
                                    "window.toggleCompleted()"
                                );
                        }
                    }
                );

            // ======================
            // Ctrl+4
            // ======================

            let _ =
                gs.on_shortcut(
                    Shortcut::new(
                        Some(
                            Modifiers::CONTROL
                        ),
                        Code::Digit4
                    ),

                    move |_app, _shortcut, event| {

                        if event.state
                            == ShortcutState::Pressed
                        {

                            std::process::exit(0);
                        }
                    }
                );

            Ok(())
        })

        .invoke_handler(
    tauri::generate_handler![
        save_memo,
        load_memo
    ]
)

        .run(
            tauri::generate_context!()
        )

        .expect(
            "error while running tauri application"
        );
}
