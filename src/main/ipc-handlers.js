const { ipcMain, session, app } = require('electron');
const path = require('path');
const { store, isMac, isWindows } = require('./store');
const { getMainWindow } = require('./window');
const { createBadgeIcon } = require('./tray');

// 通知バッジカウント管理
let totalBadgeCount = 0;
const serviceBadgeCounts = {};

function setupIpcHandlers() {
  // ========================================
  // サービス関連
  // ========================================
  ipcMain.handle('get-services', () => {
    return store.get('services');
  });

  ipcMain.handle('add-service', (event, service) => {
    const services = store.get('services');
    const newService = {
      id: `custom-${Date.now()}`,
      name: service.name,
      url: service.url,
      icon: service.icon || '🔗',
      enabled: true
    };
    services.push(newService);
    store.set('services', services);

    // 新しいサービスのセッションにプリロードスクリプトを設定
    const ses = session.fromPartition(`persist:${newService.id}`);
    ses.setPreloads([path.join(__dirname, '../preload/webview-preload.js')]);

    return services;
  });

  ipcMain.handle('remove-service', (event, serviceId) => {
    const services = store.get('services').filter(s => s.id !== serviceId);
    store.set('services', services);
    return services;
  });

  ipcMain.handle('update-service', (event, updatedService) => {
    const services = store.get('services').map(s =>
      s.id === updatedService.id ? updatedService : s
    );
    store.set('services', services);
    return services;
  });

  ipcMain.handle('reorder-services', (event, reorderedServices) => {
    // Validate input
    if (!Array.isArray(reorderedServices)) {
      console.error('Invalid reorder-services request: not an array');
      return store.get('services');
    }

    const currentServices = store.get('services');

    // Validate that all services have required properties
    const isValid = reorderedServices.every(service =>
      service &&
      typeof service.id === 'string' &&
      typeof service.name === 'string' &&
      typeof service.url === 'string' &&
      typeof service.icon === 'string' &&
      typeof service.enabled === 'boolean'
    );

    if (!isValid) {
      console.error('Invalid reorder-services request: missing or invalid properties');
      return currentServices;
    }

    // Validate that we have the same set of service IDs
    const currentIds = currentServices.map(s => s.id).sort();
    const reorderedIds = reorderedServices.map(s => s.id).sort();

    if (currentIds.length !== reorderedIds.length ||
        !currentIds.every((id, index) => id === reorderedIds[index])) {
      console.error('Invalid reorder-services request: service IDs do not match');
      return currentServices;
    }

    store.set('services', reorderedServices);
    return reorderedServices;
  });

  ipcMain.handle('update-service-url', (event, serviceId, url) => {
    // URLバリデーション
    if (typeof serviceId !== 'string' || typeof url !== 'string') {
      console.error('Invalid update-service-url request: invalid parameters');
      return store.get('services');
    }

    try {
      const parsedUrl = new URL(url);
      // http/httpsのみ許可
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        console.error('Invalid update-service-url request: invalid protocol');
        return store.get('services');
      }
    } catch {
      console.error('Invalid update-service-url request: invalid URL format');
      return store.get('services');
    }

    const services = store.get('services').map(s =>
      s.id === serviceId ? { ...s, url } : s
    );
    store.set('services', services);
    return services;
  });

  ipcMain.handle('get-active-service', () => {
    return store.get('activeServiceId');
  });

  ipcMain.handle('set-active-service', (event, serviceId) => {
    store.set('activeServiceId', serviceId);
    return serviceId;
  });

  // ========================================
  // AI関連
  // ========================================
  ipcMain.handle('get-gemini-url', () => {
    return store.get('geminiUrl');
  });

  ipcMain.handle('get-show-ai-companion', () => {
    return store.get('showAiCompanion');
  });

  ipcMain.handle('set-show-ai-companion', (event, show) => {
    store.set('showAiCompanion', show);
    return show;
  });

  ipcMain.handle('get-ai-width', () => {
    return store.get('aiWidth', 400);
  });

  ipcMain.handle('set-ai-width', (event, width) => {
    // 幅のバリデーション（300-800px）
    if (typeof width !== 'number' || isNaN(width) || width < 300 || width > 800) {
      console.warn('Invalid AI width:', width);
      return store.get('aiWidth', 400);
    }
    store.set('aiWidth', width);
    return width;
  });

  ipcMain.handle('get-ai-services', () => {
    return store.get('aiServices');
  });

  ipcMain.handle('get-active-ai-service', () => {
    const activeId = store.get('activeAiServiceId');
    const services = store.get('aiServices');
    return services.find(s => s.id === activeId) || services[0];
  });

  ipcMain.handle('set-active-ai-service', (event, serviceId) => {
    const services = store.get('aiServices');
    const service = services.find(s => s.id === serviceId);
    if (service) {
      store.set('activeAiServiceId', serviceId);
      return service;
    }
    return null;
  });

  ipcMain.handle('add-ai-service', (event, service) => {
    const services = store.get('aiServices');
    const newService = {
      id: `ai-${Date.now()}`,
      name: service.name,
      url: service.url,
      isDefault: false
    };
    services.push(newService);
    store.set('aiServices', services);
    return services;
  });

  ipcMain.handle('remove-ai-service', (event, serviceId) => {
    let services = store.get('aiServices');
    const service = services.find(s => s.id === serviceId);

    // デフォルトのサービスは削除不可
    if (service && service.isDefault) {
      return services;
    }

    services = services.filter(s => s.id !== serviceId);
    store.set('aiServices', services);

    // 削除したサービスがアクティブだった場合、最初のサービスをアクティブに
    const activeId = store.get('activeAiServiceId');
    if (activeId === serviceId && services.length > 0) {
      store.set('activeAiServiceId', services[0].id);
    }

    return services;
  });

  // ========================================
  // バッジ関連
  // ========================================
  ipcMain.on('update-badge', (event, { serviceId, count }) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('badge-updated', { serviceId, count });
    }

    // バッジカウントを更新
    serviceBadgeCounts[serviceId] = count;
    totalBadgeCount = Object.values(serviceBadgeCounts).reduce((sum, c) => sum + c, 0);

    // macOS: ドックバッジを更新
    if (isMac) {
      app.dock.setBadge(totalBadgeCount > 0 ? totalBadgeCount.toString() : '');
    }
    // Windows: タスクバーオーバーレイアイコンを更新
    else if (isWindows && mainWindow) {
      if (totalBadgeCount > 0) {
        // バッジ付きオーバーレイアイコンを作成
        const badgeIcon = createBadgeIcon(totalBadgeCount);
        mainWindow.setOverlayIcon(badgeIcon, `${totalBadgeCount} 件の通知`);
      } else {
        mainWindow.setOverlayIcon(null, '');
      }
    }
  });

  // ========================================
  // ウィンドウ操作（Windows用カスタムタイトルバー）
  // ========================================
  ipcMain.on('window-minimize', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('window-is-maximized', () => {
    const mainWindow = getMainWindow();
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  // ========================================
  // プラットフォーム情報
  // ========================================
  ipcMain.handle('get-platform', () => {
    return process.platform;
  });
}

module.exports = {
  setupIpcHandlers
};
