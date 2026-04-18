mod commands;
mod notification;
mod state;
mod store;
mod tray;
mod webview_manager;

use state::AppState;
use std::sync::Mutex;
use tauri::Manager;

pub fn run() {
    let app_state = AppState::default();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(app_state))
        .invoke_handler(tauri::generate_handler![
            commands::get_services,
            commands::add_service,
            commands::remove_service,
            commands::update_service,
            commands::reorder_services,
            commands::get_active_service,
            commands::set_active_service,
            commands::get_ai_services,
            commands::get_active_ai_service,
            commands::set_active_ai_service,
            commands::add_ai_service,
            commands::remove_ai_service,
            commands::get_show_ai_companion,
            commands::set_show_ai_companion,
            commands::get_ai_width,
            commands::set_ai_width,
            commands::get_platform,
            commands::window_minimize,
            commands::window_maximize,
            commands::window_close,
            commands::window_is_maximized,
            commands::create_service_webview,
            commands::switch_service_webview,
            commands::remove_service_webview,
            commands::create_ai_webview,
            commands::toggle_ai_webview,
            commands::resize_ai_webview,
            commands::update_layout,
            commands::create_all_service_webviews,
            commands::setup_ai_webview,
            commands::switch_ai_service,
            commands::send_to_ai_webview,
            commands::update_notification_count,
            commands::update_favicon,
            commands::open_popup_window,
            commands::hide_all_child_webviews,
            commands::restore_child_webviews,
            commands::request_open_modal,
        ])
        .on_window_event(|window, event| {
            let app_handle = window.app_handle();

            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    if let Some(ww) = app_handle.get_webview_window("main") {
                        if let Ok(size) = ww.inner_size() {
                            let state = app_handle.state::<Mutex<AppState>>();
                            let mut s = state.lock().unwrap();
                            s.window_bounds.width = size.width;
                            s.window_bounds.height = size.height;
                            store::save_state(app_handle, &s);
                        }
                    }
                }
            }
        })
        .setup(|app| {
            // Load state from store
            store::load_state(app.handle(), &app.state::<Mutex<AppState>>());

            // Setup system tray
            tray::setup_tray(app)?;

            // Create all service webview windows in setup (main thread)
            // This avoids the deadlock that occurs when creating windows from command threads
            {
                // Collect service info first, then release the lock
                let (services_info, active_service_id) = {
                    let state = app.state::<Mutex<AppState>>();
                    let s = state.lock().unwrap();
                    let services: Vec<(String, String)> = s
                        .services
                        .iter()
                        .filter(|svc| svc.enabled)
                        .map(|svc| (svc.id.clone(), svc.url.clone()))
                        .collect();
                    let active = s.active_service_id.clone();
                    (services, active)
                };
                // Lock released

                let main_win = app.get_window("main");

                if let Some(ref main_win) = main_win {
                    let layout = {
                        let state = app.state::<Mutex<AppState>>();
                        let s = state.lock().unwrap();
                        webview_manager::get_layout_params(main_win, &s)
                    };

                    if let Some(layout) = layout {
                        let mut created_labels: Vec<String> = Vec::new();

                        // Create chrome (dock) webview first — always visible
                        println!("[setup] Creating chrome webview");
                        match webview_manager::create_chrome_webview(main_win, &layout) {
                            Ok(_) => println!("[setup] Created chrome webview OK"),
                            Err(e) => println!("[setup] Failed to create chrome webview: {}", e),
                        }

                        // Create ONLY the active service webview.
                        // Other services are created lazily on first switch.
                        if let Some((service_id, url)) = services_info
                            .iter()
                            .find(|(id, _)| *id == active_service_id)
                            .or_else(|| services_info.first())
                        {
                            let label = format!("service-{}", service_id);
                            println!("[setup] Creating active service webview: {}", label);
                            match webview_manager::create_service_webview(
                                app.handle(),
                                main_win,
                                &label,
                                url,
                                &layout,
                            ) {
                                Ok(wv) => {
                                    let _ = wv.show();
                                    created_labels.push(label);
                                    println!("[setup] Created active service webview OK");
                                }
                                Err(e) => println!(
                                    "[setup] Failed to create active service webview: {}",
                                    e
                                ),
                            }
                        }

                        // AI webview is created lazily via setup_ai_webview command.

                        // Update state with created labels
                        {
                            let state = app.state::<Mutex<AppState>>();
                            let mut s = state.lock().unwrap();
                            for label in created_labels {
                                if !s.created_webview_labels.contains(&label) {
                                    s.created_webview_labels.push(label);
                                }
                            }
                        }
                    }
                }
            }

            // Open DevTools in dev mode
            #[cfg(debug_assertions)]
            if let Some(ww) = app.get_webview_window("main") {
                ww.open_devtools();
            }

            // Start notification polling for external webviews
            // let app_handle = app.handle().clone();
            // std::thread::spawn(move || {
            //     notification::start_title_polling(app_handle);
            // });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
