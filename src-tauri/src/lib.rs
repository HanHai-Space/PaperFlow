use tauri::{command, Window, Manager, AppHandle, Emitter};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use std::path::PathBuf;
use std::fs;
use std::process::Command;

#[command]
async fn set_window_theme(window: Window, theme: String) -> Result<(), String> {
    match theme.as_str() {
        "dark" => {
            window.set_theme(Some(tauri::Theme::Dark))
                .map_err(|e| format!("Failed to set dark theme: {}", e))?;
        }
        "light" => {
            window.set_theme(Some(tauri::Theme::Light))
                .map_err(|e| format!("Failed to set light theme: {}", e))?;
        }
        _ => return Err("Invalid theme. Use 'dark' or 'light'".to_string()),
    }
    Ok(())
}

#[command]
async fn minimize_window(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| format!("Failed to minimize window: {}", e))
}

#[command]
async fn toggle_maximize(window: Window) -> Result<(), String> {
    let is_maximized = window.is_maximized().map_err(|e| format!("Failed to check maximize state: {}", e))?;
    if is_maximized {
        window.unmaximize().map_err(|e| format!("Failed to unmaximize window: {}", e))
    } else {
        window.maximize().map_err(|e| format!("Failed to maximize window: {}", e))
    }
}

#[command]
async fn close_window(window: Window) -> Result<(), String> {
    // 隐藏窗口而不是关闭，实现托盘功能
    window.hide().map_err(|e| format!("Failed to hide window: {}", e))
}

#[command]
async fn quit_app(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[command]
async fn is_window_maximized(window: Window) -> Result<bool, String> {
    window.is_maximized().map_err(|e| format!("Failed to check maximize state: {}", e))
}

#[command]
async fn select_files() -> Result<Vec<String>, String> {
    // 对于 Tauri 2.x，我们将返回一个简单的错误消息
    // 实际的文件选择将在前端通过 @tauri-apps/api/dialog 处理
    Err("Use frontend dialog API".to_string())
}

#[command]
async fn select_directory() -> Result<Option<String>, String> {
    // 对于 Tauri 2.x，我们将返回一个简单的错误消息
    // 实际的目录选择将在前端通过 @tauri-apps/api/dialog 处理
    Err("Use frontend dialog API".to_string())
}

// 文件系统操作命令
#[command]
async fn create_dir_all(path: String) -> Result<(), String> {
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory {}: {}", path, e))
}

#[command]
async fn write_text_file(path: String, data: String) -> Result<(), String> {
    fs::write(&path, data)
        .map_err(|e| format!("Failed to write text file {}: {}", path, e))
}

#[command]
async fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(&path, data)
        .map_err(|e| format!("Failed to write binary file {}: {}", path, e))
}

#[command]
async fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read text file {}: {}", path, e))
}

#[command]
async fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path)
        .map_err(|e| format!("Failed to read binary file {}: {}", path, e))
}

#[command]
async fn exists(path: String) -> Result<bool, String> {
    Ok(PathBuf::from(&path).exists())
}

#[command]
async fn remove_file(path: String) -> Result<(), String> {
    fs::remove_file(&path)
        .map_err(|e| format!("Failed to remove file {}: {}", path, e))
}

#[command]
async fn remove_dir(path: String) -> Result<(), String> {
    fs::remove_dir_all(&path)
        .map_err(|e| format!("Failed to remove directory {}: {}", path, e))
}

#[command]
async fn get_download_dir() -> Result<String, String> {
    if let Some(download_dir) = dirs::download_dir() {
        Ok(download_dir.to_string_lossy().to_string())
    } else {
        // 如果无法获取下载目录，返回默认路径
        Ok("C:/download".to_string())
    }
}

#[command]
async fn get_username() -> Result<String, String> {
    // 尝试获取用户名
    if let Ok(username) = std::env::var("USERNAME") {
        Ok(username)
    } else if let Ok(username) = std::env::var("USER") {
        Ok(username)
    } else {
        // 如果无法获取用户名，返回默认值
        Ok("User".to_string())
    }
}

#[command]
async fn get_default_pdf2md_dir() -> Result<String, String> {
    // 获取用户名
    let username = if let Ok(username) = std::env::var("USERNAME") {
        username
    } else if let Ok(username) = std::env::var("USER") {
        username
    } else {
        "User".to_string()
    };

    // 构建默认路径：C:\Users\{username}\Downloads\pdf2md\
    let default_path = format!("C:\\Users\\{}\\Downloads\\pdf2md\\", username);
    Ok(default_path)
}

// 处理会话状态管理命令
#[command]
async fn save_session_state(session_id: String, state_data: String, save_dir: String) -> Result<(), String> {
    let session_dir = PathBuf::from(&save_dir).join("sessions");
    fs::create_dir_all(&session_dir)
        .map_err(|e| format!("Failed to create session directory: {}", e))?;

    let session_file = session_dir.join(format!("{}.json", session_id));
    fs::write(&session_file, state_data)
        .map_err(|e| format!("Failed to save session state: {}", e))
}

#[command]
async fn load_session_state(session_id: String, save_dir: String) -> Result<String, String> {
    let session_file = PathBuf::from(&save_dir).join("sessions").join(format!("{}.json", session_id));
    fs::read_to_string(&session_file)
        .map_err(|e| format!("Failed to load session state: {}", e))
}

#[command]
async fn list_session_files(save_dir: String) -> Result<Vec<String>, String> {
    let session_dir = PathBuf::from(&save_dir).join("sessions");
    if !session_dir.exists() {
        return Ok(vec![]);
    }

    let mut sessions = Vec::new();
    let entries = fs::read_dir(&session_dir)
        .map_err(|e| format!("Failed to read session directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Some(file_name) = path.file_stem().and_then(|s| s.to_str()) {
                sessions.push(file_name.to_string());
            }
        }
    }

    Ok(sessions)
}

// ZIP文件操作命令
#[command]
async fn save_zip_file(zip_data: Vec<u8>, file_path: String) -> Result<(), String> {
    println!("Attempting to save ZIP file to: {}", file_path);
    println!("ZIP data size: {} bytes", zip_data.len());

    let path = PathBuf::from(&file_path);

    // 确保目录存在
    if let Some(parent) = path.parent() {
        println!("Creating directory: {:?}", parent);
        fs::create_dir_all(parent)
            .map_err(|e| {
                let error_msg = format!("Failed to create directory {:?}: {}", parent, e);
                println!("Directory creation error: {}", error_msg);
                error_msg
            })?;
        println!("Directory created successfully");
    }

    // 检查目录是否可写
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            return Err(format!("Directory does not exist after creation: {:?}", parent));
        }

        // 尝试创建测试文件来验证权限
        let test_file = parent.join("test_write.tmp");
        match fs::write(&test_file, b"test") {
            Ok(_) => {
                let _ = fs::remove_file(&test_file); // 清理测试文件
                println!("Directory write permission verified");
            }
            Err(e) => {
                return Err(format!("Directory is not writable: {}", e));
            }
        }
    }

    // 保存ZIP文件
    println!("Writing ZIP file...");
    fs::write(&path, zip_data)
        .map_err(|e| {
            let error_msg = format!("Failed to save ZIP file to {}: {}", file_path, e);
            println!("ZIP save error: {}", error_msg);
            error_msg
        })?;

    println!("ZIP file saved successfully to: {}", file_path);
    Ok(())
}

// 临时文件管理命令
#[command]
async fn save_temp_file(file_name: String, content: String, temp_dir: String) -> Result<String, String> {
    let temp_path = PathBuf::from(&temp_dir).join("temp");
    fs::create_dir_all(&temp_path)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    let file_path = temp_path.join(&file_name);
    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to save temp file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[command]
async fn load_temp_file(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to load temp file: {}", e))
}

#[command]
async fn cleanup_temp_files(temp_dir: String, session_id: String) -> Result<(), String> {
    let temp_path = PathBuf::from(&temp_dir).join("temp").join(&session_id);
    if temp_path.exists() {
        fs::remove_dir_all(&temp_path)
            .map_err(|e| format!("Failed to cleanup temp files: {}", e))?;
    }
    Ok(())
}

// 执行 Pandoc 命令
#[command]
async fn execute_pandoc(pandoc_path: String, args: Vec<String>) -> Result<serde_json::Value, String> {
    println!("Executing pandoc command: {} {:?}", pandoc_path, args);

    let output = Command::new(&pandoc_path)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute pandoc: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    println!("Pandoc stdout: {}", stdout);
    println!("Pandoc stderr: {}", stderr);

    if output.status.success() {
        Ok(serde_json::json!({
            "success": true,
            "output": stdout.to_string(),
            "error": null
        }))
    } else {
        Ok(serde_json::json!({
            "success": false,
            "output": stdout.to_string(),
            "error": stderr.to_string()
        }))
    }
}

#[command]
async fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| format!("Failed to show window: {}", e))?;
        window.set_focus().map_err(|e| format!("Failed to focus window: {}", e))?;
    }
    Ok(())
}

#[command]
async fn hide_to_tray(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| format!("Failed to hide window: {}", e))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![
      set_window_theme,
      minimize_window,
      toggle_maximize,
      close_window,
      is_window_maximized,
      select_files,
      select_directory,
      create_dir_all,
      write_text_file,
      write_binary_file,
      read_text_file,
      read_binary_file,
      exists,
      remove_file,
      remove_dir,
      get_download_dir,
      get_username,
      get_default_pdf2md_dir,
      save_session_state,
      load_session_state,
      list_session_files,
      save_zip_file,
      save_temp_file,
      load_temp_file,
      cleanup_temp_files,
      execute_pandoc,
      show_main_window,
      hide_to_tray,
      quit_app
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .filter(|metadata| {
              // 过滤掉WebView2的重复错误日志和tao事件循环警告
              !metadata.target().contains("tauri_runtime_wry") &&
              !metadata.target().contains("tao::platform_impl::platform::event_loop::runner")
            })
            .build(),
        )?;
      }

      // 创建托盘菜单
      let open_item = MenuItem::with_id(app, "open", "打开应用", true, None::<&str>)?;
      let settings_item = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
      let pdf_translate_item = MenuItem::with_id(app, "pdf_translate", "PDF翻译", true, None::<&str>)?;
      let separator = PredefinedMenuItem::separator(app)?;
      let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

      let menu = Menu::with_items(app, &[
        &open_item,
        &separator,
        &settings_item,
        &pdf_translate_item,
        &separator,
        &quit_item,
      ])?;

      // 创建托盘图标
      let _tray = TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("Paper Burner - PDF OCR与翻译工具")
        .on_menu_event(move |app, event| {
          match event.id.as_ref() {
            "open" => {
              if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
              }
            }
            "settings" => {
              if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                // 发送事件到前端切换到设置页面
                let _ = window.emit("navigate-to-settings", ());
              }
            }
            "pdf_translate" => {
              if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                // 发送事件到前端切换到文件处理页面
                let _ = window.emit("navigate-to-upload", ());
              }
            }
            "quit" => {
              app.exit(0);
            }
            _ => {}
          }
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::DoubleClick { .. } = event {
            if let Some(app) = tray.app_handle().get_webview_window("main") {
              let _ = app.show();
              let _ = app.set_focus();
            }
          }
        })
        .build(app)?;

      // 显示主窗口
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();

        // 监听文件拖拽事件
        let window_clone = window.clone();
        window.on_window_event(move |event| {
          match event {
            tauri::WindowEvent::DragDrop(drag_drop_event) => {
              match drag_drop_event {
                tauri::DragDropEvent::Drop { paths, position: _ } => {
                  // 过滤PDF文件
                  let pdf_paths: Vec<String> = paths
                    .iter()
                    .filter(|path| {
                      path.extension()
                        .and_then(|ext| ext.to_str())
                        .map(|ext| ext.to_lowercase() == "pdf")
                        .unwrap_or(false)
                    })
                    .map(|path| path.to_string_lossy().to_string())
                    .collect();

                  if !pdf_paths.is_empty() {
                    // 发送拖拽事件到前端
                    let _ = window_clone.emit("tauri-file-drop", pdf_paths);
                  }
                }
                tauri::DragDropEvent::Enter { paths, position: _ } => {
                  // 文件进入事件
                  let has_pdf = paths.iter().any(|path| {
                    path.extension()
                      .and_then(|ext| ext.to_str())
                      .map(|ext| ext.to_lowercase() == "pdf")
                      .unwrap_or(false)
                  });

                  if has_pdf {
                    let _ = window_clone.emit("tauri-file-hover", true);
                  }
                }
                tauri::DragDropEvent::Over { position: _ } => {
                  // 文件悬停事件 - 保持当前状态
                }
                tauri::DragDropEvent::Leave => {
                  // 拖拽离开事件
                  let _ = window_clone.emit("tauri-file-hover", false);
                }
                _ => {
                  // 处理其他可能的拖拽事件
                }
              }
            }
            _ => {}
          }
        });
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
