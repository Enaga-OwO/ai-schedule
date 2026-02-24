// プッシュ通知ユーティリティ

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function sendNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission !== 'granted') return;
  
  // Service Worker経由で通知（バックグラウンドでも動作）
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        ...options,
      });
    });
  } else {
    new Notification(title, {
      icon: '/icons/icon-192x192.png',
      ...options,
    });
  }
}

// 集中タイム中の離脱検知通知
let focusNotificationInterval: NodeJS.Timeout | null = null;
let isInFocusMode = false;

export function startFocusNotifications(taskName: string) {
  isInFocusMode = true;
  
  // ページ非表示イベント検知
  const handleVisibilityChange = () => {
    if (document.hidden && isInFocusMode) {
      // 少し待ってから通知（意図的な切り替えに配慮）
      setTimeout(() => {
        if (document.hidden && isInFocusMode) {
          sendFocusReminder(taskName);
        }
      }, 3000);
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // 定期的な通知（5分ごと、非表示時のみ）
  focusNotificationInterval = setInterval(() => {
    if (document.hidden && isInFocusMode) {
      sendFocusReminder(taskName);
    }
  }, 5 * 60 * 1000);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

export function stopFocusNotifications() {
  isInFocusMode = false;
  if (focusNotificationInterval) {
    clearInterval(focusNotificationInterval);
    focusNotificationInterval = null;
  }
}

function sendFocusReminder(taskName: string) {
  const messages = [
    `📚 「${taskName}」の集中タイム中だよ！戻っておいで！`,
    `💪 あと少し！アプリを開いて続けよう！`,
    `🎯 集中タイム進行中！サボってない？笑`,
    `⏰ タイマー動いてるよ〜！戻ってきて！`,
    `🔥 諦めないで！ここが踏ん張りどころ！`,
  ];
  
  const message = messages[Math.floor(Math.random() * messages.length)];
  
  sendNotification('生活改善AI', {
    body: message,
    tag: 'focus-reminder',
    requireInteraction: true,
    data: { type: 'focus-reminder', taskName },
  });
}

// タスクリマインダー
export function scheduleTaskReminder(taskName: string, scheduledAt: Date) {
  const now = new Date();
  const delay = scheduledAt.getTime() - now.getTime() - (5 * 60 * 1000); // 5分前
  
  if (delay > 0) {
    setTimeout(() => {
      sendNotification('📅 タスクのお知らせ', {
        body: `5分後に「${taskName}」の時間だよ！`,
        tag: `task-${taskName}`,
      });
    }, delay);
  }
}

// Service Workerへのフォーカスモード通知
export function registerFocusModeWithSW(active: boolean, taskName?: string) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'FOCUS_MODE',
      active,
      taskName,
    });
  }
}
