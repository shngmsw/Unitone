use crate::state::AppState;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

const DOCK_WIDTH: f64 = 64.0;

/// Chrome-compatible User-Agent strings (platform-specific).
/// Slack や Google Chat は UA ヘッダだけでなく JS の navigator API でもブラウザを判定する。
/// プラットフォームに合った Chrome UA を設定し、初期化スクリプトで navigator.userAgentData も偽装する。
#[cfg(target_os = "macos")]
const CHROME_USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
#[cfg(target_os = "windows")]
const CHROME_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
const CHROME_USER_AGENT: &str = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

/// Chrome を完全に偽装するための JS 初期化スクリプト。
/// navigator.userAgentData (Client Hints API) がないと Slack 等に弾かれるため追加する。
const BROWSER_SPOOF_SCRIPT: &str = r#"
(function() {
  // === navigator 偽装 (DOM 不要、最優先で実行) ===
  Object.defineProperty(navigator, 'userAgent', {
    get: function() { return 'USER_AGENT_PLACEHOLDER'; },
    configurable: true
  });
  Object.defineProperty(navigator, 'userAgentData', {
    get: function() {
      return {
        brands: [
          { brand: 'Chromium', version: '134' },
          { brand: 'Google Chrome', version: '134' },
          { brand: 'Not:A-Brand', version: '99' }
        ],
        mobile: false,
        platform: 'PLATFORM_PLACEHOLDER',
        getHighEntropyValues: function(hints) {
          return Promise.resolve({
            brands: this.brands, mobile: false,
            platform: 'PLATFORM_PLACEHOLDER', platformVersion: '15.0.0',
            architecture: 'x86', bitness: '64',
            fullVersionList: [
              { brand: 'Chromium', version: '134.0.6998.89' },
              { brand: 'Google Chrome', version: '134.0.6998.89' },
              { brand: 'Not:A-Brand', version: '99.0.0.0' }
            ],
            model: '', uaFullVersion: '134.0.6998.89'
          });
        }
      };
    },
    configurable: true
  });
  Object.defineProperty(navigator, 'vendor', {
    get: function() { return 'Google Inc.'; },
    configurable: true
  });
  Object.defineProperty(navigator, 'appVersion', {
    get: function() { return '5.0 (PLATFORM_UA_PLACEHOLDER)'; },
    configurable: true
  });

    // === window.open 等を同じウィンドウ内ナビゲーションに変換し、Rust 側の on_navigation で制御する ===
    var _origOpen = window.open;
    window.open = function(url, target, features) {
      if (url && url !== '' && url !== 'about:blank') {
        try {
          var fullUrl = new URL(url, window.location.href).href;
          console.log('[window.open -> same-window navigate]', fullUrl);
          window.location.href = fullUrl;
        } catch(e) {
          console.error('[window.open] error:', e);
        }
        return null;
      }
      return _origOpen ? _origOpen.call(window, url, target, features) : null;
    };

    // === DOM 準備後に実行する処理 ===
    function onReady() {
      // target="_blank" 等のリンクを同じウィンドウで開く（Rust の on_navigation でブラウザ送りにするため）
      document.addEventListener('click', function(e) {
        var link = e.target.closest && e.target.closest('a[target="_blank"], a[target="new"]');
        if (link && link.href) {
          e.preventDefault();
          e.stopPropagation();
          console.log('[target=_blank -> same-window navigate]', link.href);
          window.location.href = link.href;
        }
      }, true);

      // 非推奨バナーを非表示にする CSS
    var style = document.createElement('style');
    style.textContent = [
      '[data-qa="browser_deprecation_banner"] { display: none !important; }',
      '.p-browser_deprecation_banner { display: none !important; }',
      '.c-banner--warning { display: none !important; }',
      '[data-unsupported-browser] { display: none !important; }',
      '.unsupported-browser-banner { display: none !important; }'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);

    // SPA 対応: DOM 更新時にもバナーを消す
    if (document.body) {
      var observer = new MutationObserver(function() {
        document.querySelectorAll(
          '[data-qa="browser_deprecation_banner"], .p-browser_deprecation_banner, .c-banner--warning'
        ).forEach(function(el) { el.remove(); });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
"#;

/// プラットフォームに合わせて JS スクリプト内のプレースホルダを置換
pub fn browser_spoof_script() -> String {
    #[cfg(target_os = "macos")]
    let (platform, platform_ua) = ("macOS", "Macintosh; Intel Mac OS X 10_15_7");
    #[cfg(target_os = "windows")]
    let (platform, platform_ua) = ("Windows", "Windows NT 10.0; Win64; x64");
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let (platform, platform_ua) = ("Linux", "X11; Linux x86_64");

    BROWSER_SPOOF_SCRIPT
        .replace("USER_AGENT_PLACEHOLDER", CHROME_USER_AGENT)
        .replace("PLATFORM_PLACEHOLDER", platform)
        .replace("PLATFORM_UA_PLACEHOLDER", platform_ua)
}

/// Chrome UA 文字列を返す
pub fn chrome_user_agent() -> &'static str {
    CHROME_USER_AGENT
}

pub struct LayoutParams {
    pub chrome_x: f64,
    pub chrome_y: f64,
    pub chrome_width: f64,
    pub chrome_height: f64,
    pub service_x: f64,
    pub service_y: f64,
    pub service_width: f64,
    pub service_height: f64,
    pub ai_x: f64,
    pub ai_y: f64,
    pub ai_width: f64,
    pub ai_height: f64,
}

/// Position a child Webview.
fn position_child(child: &tauri::Webview, rel_x: f64, rel_y: f64, width: f64, height: f64) {
    let _ = child.set_position(tauri::LogicalPosition::new(rel_x, rel_y));
    let _ = child.set_size(tauri::LogicalSize::new(width, height));
}

/// Calculate service and AI layout areas within the main window's client area.
pub fn get_layout_params(main_window: &tauri::Window, state: &AppState) -> Option<LayoutParams> {
    let window_size = main_window.inner_size().ok()?;
    let scale = main_window.scale_factor().unwrap_or(1.0);
    let w = window_size.width as f64 / scale;
    let h = window_size.height as f64 / scale;
    let ai_w = if state.show_ai_companion {
        state.ai_width as f64
    } else {
        0.0
    };

    Some(LayoutParams {
        chrome_x: 0.0,
        chrome_y: 0.0,
        chrome_width: DOCK_WIDTH,
        chrome_height: h,
        service_x: DOCK_WIDTH,
        service_y: 0.0,
        service_width: (w - DOCK_WIDTH - ai_w).max(100.0),
        service_height: h,
        ai_x: w - state.ai_width as f64,
        ai_y: 0.0,
        ai_width: state.ai_width as f64,
        ai_height: h,
    })
}

/// 外部 OAuth プロバイダの URL かどうかを判定する。
/// Slack 自身の /signin, /sso, /oauth 等はポップアップにせず WebView 内で処理させる。
/// ポップアップを開くのは Google, Microsoft 等の外部認証画面のみ。
pub fn is_auth_url(url: &str) -> bool {
    url.contains("accounts.google.com")
        || url.contains("login.microsoftonline.com")
        || url.contains("github.com/login/oauth")
        || url.contains("appleid.apple.com/auth")
}

/// 同じサービスのドメイン内での移動（ログイン時のリダイレクト等）かどうかを判定する。
pub fn is_internal_navigation(nav_url: &url::Url, initial_url: &url::Url) -> bool {
    let nav_host = match nav_url.host_str() {
        Some(h) => h,
        None => return true, // スキームがない場合などは許可
    };
    let initial_host = match initial_url.host_str() {
        Some(h) => h,
        None => return true,
    };

    if nav_host == initial_host {
        return true;
    }

    // サービスごとに許可するドメイングループ
    let internal_domain_suffixes = [
        "slack.com",
        "google.com",
        "google.co.jp",
        "discord.com",
        "microsoft.com",
        "microsoftonline.com",
        "live.com",
        "chatwork.com",
    ];

    for suffix in internal_domain_suffixes {
        let is_nav_match = nav_host == suffix || nav_host.ends_with(&format!(".{}", suffix));
        let is_initial_match =
            initial_host == suffix || initial_host.ends_with(&format!(".{}", suffix));

        if is_nav_match && is_initial_match {
            return true;
        }
    }

    false
}

/// Create the chrome (dock) child Webview.
pub fn create_chrome_webview(
    main_window: &tauri::Window,
    layout: &LayoutParams,
) -> Result<tauri::Webview, String> {
    let webview_builder =
        tauri::WebviewBuilder::new("chrome", tauri::WebviewUrl::App("chrome.html".into()));
    main_window
        .add_child(
            webview_builder,
            tauri::LogicalPosition::new(layout.chrome_x, layout.chrome_y),
            tauri::LogicalSize::new(layout.chrome_width, layout.chrome_height),
        )
        .map_err(|e: tauri::Error| e.to_string())
}

/// Create a service Webview dynamically.
pub fn create_service_webview(
    app: &tauri::AppHandle,
    main_window: &tauri::Window,
    label: &str,
    url: &str,
    layout: &LayoutParams,
) -> Result<tauri::Webview, String> {
    let parsed_url: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;

    let webview_builder =
        tauri::WebviewBuilder::new(label, tauri::WebviewUrl::External(parsed_url.clone()))
            .user_agent(CHROME_USER_AGENT)
            .initialization_script(browser_spoof_script())
            .on_navigation({
                let app_handle = app.clone();
                let initial_url = parsed_url.clone();
                move |nav_url| {
                    println!("[service-nav] {}", nav_url.as_str());
                    let is_internal = is_internal_navigation(nav_url, &initial_url);
                    let is_auth = is_auth_url(nav_url.as_str());

                    if !is_internal && !is_auth {
                        println!(
                            "[service-nav] Opening external link in browser: {}",
                            nav_url.as_str()
                        );
                        #[allow(deprecated)]
                        let _ = app_handle.shell().open(nav_url.as_str(), None);
                        return false;
                    }
                    true
                }
            });

    let webview = main_window
        .add_child(
            webview_builder,
            tauri::LogicalPosition::new(layout.service_x, layout.service_y),
            tauri::LogicalSize::new(layout.service_width, layout.service_height),
        )
        .map_err(|e: tauri::Error| e.to_string())?;

    Ok(webview)
}

/// Create the AI companion Webview dynamically.
pub fn create_ai_webview(
    app: &tauri::AppHandle,
    main_window: &tauri::Window,
    url: &str,
    layout: &LayoutParams,
) -> Result<tauri::Webview, String> {
    let parsed_url: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;

    let webview_builder = tauri::WebviewBuilder::new(
        "ai-webview",
        tauri::WebviewUrl::External(parsed_url.clone()),
    )
    .user_agent(CHROME_USER_AGENT)
    .initialization_script(browser_spoof_script())
    .on_navigation({
        let app_handle = app.clone();
        let initial_url = parsed_url.clone();
        move |nav_url| {
            println!("[ai-nav] {}", nav_url.as_str());
            let is_internal = is_internal_navigation(nav_url, &initial_url);
            let is_auth = is_auth_url(nav_url.as_str());

            if !is_internal && !is_auth {
                println!(
                    "[ai-nav] Opening external link in browser: {}",
                    nav_url.as_str()
                );
                #[allow(deprecated)]
                let _ = app_handle.shell().open(nav_url.as_str(), None);
                return false;
            }
            true
        }
    });

    let webview = main_window
        .add_child(
            webview_builder,
            tauri::LogicalPosition::new(layout.ai_x, layout.ai_y),
            tauri::LogicalSize::new(layout.ai_width, layout.ai_height),
        )
        .map_err(|e: tauri::Error| e.to_string())?;

    Ok(webview)
}

/// Switch visible service webview: show the active one, hide others.
pub fn switch_service(app_handle: &tauri::AppHandle, active_service_id: &str, state: &AppState) {
    let main_window = match app_handle.get_window("main") {
        Some(w) => w,
        None => return,
    };

    let layout = match get_layout_params(&main_window, state) {
        Some(l) => l,
        None => return,
    };

    for label in &state.created_webview_labels {
        if let Some(child) = app_handle.get_webview(label) {
            let service_id = label.strip_prefix("service-").unwrap_or(label);
            if service_id == active_service_id {
                position_child(
                    &child,
                    layout.service_x,
                    layout.service_y,
                    layout.service_width,
                    layout.service_height,
                );
                let _ = child.show();
            } else {
                let _ = child.hide();
            }
        }
    }
}

/// Update layout of all child webviews (chrome + services + AI).
pub fn update_layout(app_handle: &tauri::AppHandle, state: &AppState) {
    let main_window = match app_handle.get_window("main") {
        Some(w) => w,
        None => return,
    };

    let layout = match get_layout_params(&main_window, state) {
        Some(l) => l,
        None => return,
    };

    // Update chrome webview (dock - always visible, resizes with window)
    if let Some(chrome_wv) = app_handle.get_webview("chrome") {
        position_child(
            &chrome_wv,
            layout.chrome_x,
            layout.chrome_y,
            layout.chrome_width,
            layout.chrome_height,
        );
    }

    // Update service webviews
    for label in &state.created_webview_labels {
        if let Some(child) = app_handle.get_webview(label) {
            let service_id = label.strip_prefix("service-").unwrap_or(label);
            if service_id == state.active_service_id {
                position_child(
                    &child,
                    layout.service_x,
                    layout.service_y,
                    layout.service_width,
                    layout.service_height,
                );
                // 既に表示されているかどうかの判定は Webview インスタンスからは難しいため、
                // 少なくとも各更新での呼び出しを最小限にする。
                let _ = child.show();
            } else {
                // 非アクティブなものは隠す。
                // 頻繁な呼び出しを避けるため、ここでは show されているものだけをターゲットにしたいが、
                // ステート管理が必要。一旦そのまま。
                let _ = child.hide();
            }
        }
    }

    // Update AI webview
    if state.ai_webview_created {
        if let Some(ai_wv) = app_handle.get_webview("ai-webview") {
            if state.show_ai_companion {
                position_child(
                    &ai_wv,
                    layout.ai_x,
                    layout.ai_y,
                    layout.ai_width,
                    layout.ai_height,
                );
                let _ = ai_wv.show();
            } else {
                let _ = ai_wv.hide();
            }
        }
    }
}

/// Called when the main window is resized.
#[allow(dead_code)]
pub fn on_main_window_resized(app_handle: &tauri::AppHandle) {
    let state = app_handle.state::<std::sync::Mutex<AppState>>();
    let s = state.lock().unwrap();
    update_layout(app_handle, &s);
}
