// WebView用プリロードスクリプト
// 各チャットサービスの通知を検知する

(function() {
  // document.titleの変更を監視して通知数を検出
  let lastTitle = document.title;
  let lastCount = 0;
  let serviceId = null;
  let debounceTimer = null;

  // 通知数を抽出する正規表現パターン
  const patterns = [
    /\((\d+)\)/, // (5) Slack
    /\[(\d+)\]/, // [5]
    /(\d+)\s*new/, // 5 new messages
    /(\d+)\s*unread/ // 5 unread
  ];

  function extractNotificationCount(title) {
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return 0;
  }

  function notifyParent(count) {
    // 同じカウントなら通知しない（CPU最適化）
    if (count === lastCount) return;
    lastCount = count;

    window.parent.postMessage({
      type: 'notification-count',
      serviceId: serviceId,
      count: count
    }, '*');
  }

  // デバウンス付きタイトル変更ハンドラ（Apple Silicon最適化）
  function handleTitleChange() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    // 100msのデバウンスでCPU負荷を軽減
    debounceTimer = setTimeout(() => {
      if (document.title !== lastTitle) {
        lastTitle = document.title;
        const count = extractNotificationCount(lastTitle);
        notifyParent(count);
      }
    }, 100);
  }

  // タイトル変更の監視
  const titleObserver = new MutationObserver(handleTitleChange);

  // head要素のtitle変更を監視
  function startObserving() {
    const titleElement = document.querySelector('title');
    if (titleElement) {
      // Apple Silicon最適化: subtreeを削除して軽量化
      titleObserver.observe(titleElement, {
        childList: true,
        characterData: true
      });
    }

    // 初回チェック
    const count = extractNotificationCount(document.title);
    lastCount = count;
    window.parent.postMessage({
      type: 'notification-count',
      serviceId: serviceId,
      count: count
    }, '*');
  }

  // サービスIDを受け取る
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'set-service-id') {
      serviceId = event.data.serviceId;
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

  window.Notification = function(title, options) {
    // 親ウィンドウに通知を送信
    window.parent.postMessage({
      type: 'browser-notification',
      serviceId: serviceId,
      title: title,
      body: options?.body || ''
    }, '*');

    // オリジナルの通知を作成
    return new OriginalNotification(title, options);
  };

  // 静的プロパティをコピー
  Object.defineProperty(window.Notification, 'permission', {
    get: () => OriginalNotification.permission
  });

  window.Notification.requestPermission = OriginalNotification.requestPermission.bind(OriginalNotification);
})();
