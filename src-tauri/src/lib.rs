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
        ])
        .on_window_event(|window, event| {
            let app_handle = window.app_handle();

            match event {
                tauri::WindowEvent::CloseRequested { .. } => {
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
                tauri::WindowEvent::Resized(_) => {
                    if window.label() == "main" {
                        let state = app_handle.state::<Mutex<AppState>>();
                        let s = state.lock().unwrap();
                        webview_manager::on_main_window_resized(app_handle, &s);
                    }
                }
                _ => {}
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
                let (services_info, active_service_id, ai_url, show_ai) = {
                    let state = app.state::<Mutex<AppState>>();
                    let s = state.lock().unwrap();
                    let services: Vec<(String, String)> = s
                        .services
                        .iter()
                        .filter(|svc| svc.enabled)
                        .map(|svc| (svc.id.clone(), svc.url.clone()))
                        .collect();
                    let active = s.active_service_id.clone();
                    let ai_url = s
                        .ai_services
                        .iter()
                        .find(|svc| svc.id == s.active_ai_service_id)
                        .or_else(|| s.ai_services.first())
                        .map(|svc| svc.url.clone());
                    let show_ai = s.show_ai_companion;
                    (services, active, ai_url, show_ai)
                };
                // Lock released

                let main_ww = app.get_webview_window("main");

                if let Some(ref main_ww) = main_ww {
                    let layout = {
                        let state = app.state::<Mutex<AppState>>();
                        let s = state.lock().unwrap();
                        webview_manager::get_layout_params(main_ww, &s)
                    };

                    if let Some(layout) = layout {
                        let mut created_labels: Vec<String> = Vec::new();

                        // Create service webview windows
                        for (service_id, url) in &services_info {
                            let label = format!("service-{}", service_id);
                            println!("[setup] Creating service webview: {}", label);

                            match webview_manager::create_service_webview_window(
                                app.handle(),
                                main_ww,
                                &label,
                                url,
                                &layout,
                            ) {
                                Ok(ww) => {
                                    if *service_id != active_service_id {
                                        let _ = ww.hide();
                                    } else {
                                        let _ = ww.show();
                                    }
                                    created_labels.push(label);
                                    println!("[setup] Created service webview OK");
                                }
                                Err(e) => {
                                    println!("[setup] Failed to create {}: {}", label, e);
                                }
                            }
                        }

                        // Create AI webview window
                        if let Some(url) = &ai_url {
                            println!("[setup] Creating AI webview");
                            match webview_manager::create_ai_webview_window(
                                app.handle(),
                                main_ww,
                                url,
                                &layout,
                            ) {
                                Ok(ai_ww) => {
                                    if !show_ai {
                                        let _ = ai_ww.hide();
                                    } else {
                                        let _ = ai_ww.show();
                                    }
                                    println!("[setup] Created AI webview OK");

                                    let state = app.state::<Mutex<AppState>>();
                                    let mut s = state.lock().unwrap();
                                    s.ai_webview_created = true;
                                }
                                Err(e) => {
                                    println!("[setup] Failed to create AI webview: {}", e);
                                }
                            }
                        }

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
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                notification::start_title_polling(app_handle);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
