// WebView用プリロードスクリプト
// 各チャットサービスの通知を検知する

const { ipcRenderer } = require('electron');

(function() {
  'use strict';

  // document.titleの変更を監視して通知数を検出
  let lastTitle = document.title || '';
  let lastCount = 0;
  let serviceId = null;
  let debounceTimer = null;

  // 通知数を抽出する正規表現パターン
  const patterns = Object.freeze([
    /\((\d+)\)/, // (5) Slack
    /\[(\d+)\]/, // [5]
    /(\d+)\s*new/, // 5 new messages
    /(\d+)\s*unread/ // 5 unread
  ]);

  // 通知数の上限（異常値対策）
  const MAX_NOTIFICATION_COUNT = 9999;

  function extractNotificationCount(title) {
    if (typeof title !== 'string') return 0;

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        const count = parseInt(match[1], 10);
        // 異常値を制限
        return Math.min(Math.max(0, count), MAX_NOTIFICATION_COUNT);
      }
    }
    return 0;
  }

  function notifyParent(count) {
    // 同じカウントなら通知しない（CPU最適化）
    if (count === lastCount) return;
    lastCount = count;

    try {
      // webviewからrendererにメッセージを送信
      ipcRenderer.sendToHost('notification-count', count);
    } catch (error) {
      // sendToHost失敗時は静かに無視（webviewが破棄されている可能性）
    }
  }

  // デバウンス付きタイトル変更ハンドラ（Apple Silicon最適化）
  function handleTitleChange() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    // 100msのデバウンスでCPU負荷を軽減
    debounceTimer = setTimeout(() => {
      try {
        const currentTitle = document.title || '';
        if (currentTitle !== lastTitle) {
          lastTitle = currentTitle;
          const count = extractNotificationCount(lastTitle);
          notifyParent(count);
        }
      } catch (error) {
        // DOM操作失敗時は静かに無視
      }
    }, 100);
  }

  // タイトル変更の監視
  const titleObserver = new MutationObserver(handleTitleChange);

  // head要素のtitle変更を監視
  function startObserving() {
    try {
      const titleElement = document.querySelector('title');
      if (titleElement) {
        // Apple Silicon最適化: subtreeを削除して軽量化
        titleObserver.observe(titleElement, {
          childList: true,
          characterData: true
        });
      }

      // 初回チェック
      const count = extractNotificationCount(document.title || '');
      lastCount = count;
      ipcRenderer.sendToHost('notification-count', count);
    } catch (error) {
      // 初期化失敗時は静かに無視
    }
  }

  // サービスIDを受け取る（origin検証付き）
  window.addEventListener('message', (event) => {
    try {
      // 同一オリジンまたは親ウィンドウからのメッセージのみ許可
      // webviewの場合、event.sourceがnullになることがある
      if (event.source !== null && event.source !== window.parent && event.source !== window) {
        return;
      }

      if (event.data && typeof event.data === 'object' && event.data.type === 'set-service-id') {
        // serviceIdのバリデーション
        if (typeof event.data.serviceId === 'string' && event.data.serviceId.length <= 100) {
          serviceId = event.data.serviceId;
        }
      }
    } catch (error) {
      // メッセージ処理失敗時は静かに無視
    }
  });

  // DOMContentLoaded後に監視開始
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserving);
  } else {
    startObserving();
  }

  // Notification APIをオーバーライドして通知を検知
  const OriginalNotification = window.Notification;

  if (OriginalNotification) {
    const NotificationProxy = function(title, options) {
      try {
        // 入力のサニタイズ
        const safeTitle = typeof title === 'string' ? title.slice(0, 200) : '';
        const safeBody = (options?.body && typeof options.body === 'string')
          ? options.body.slice(0, 500)
          : '';

        // 親ウィンドウに通知を送信
        ipcRenderer.sendToHost('browser-notification', {
          title: safeTitle,
          body: safeBody
        });
      } catch (error) {
        // 通知送信失敗時は静かに無視
      }

      // オリジナルの通知を作成
      return new OriginalNotification(title, options);
    };

    // 静的プロパティをコピー
    Object.defineProperty(NotificationProxy, 'permission', {
      get: () => OriginalNotification.permission
    });

    NotificationProxy.requestPermission = OriginalNotification.requestPermission.bind(OriginalNotification);

    // プロトタイプチェーンを維持
    NotificationProxy.prototype = OriginalNotification.prototype;

    window.Notification = NotificationProxy;
  }
})();
