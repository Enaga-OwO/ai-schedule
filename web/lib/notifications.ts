export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function sendNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission !== 'granted') return;

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        ...options,
      } as NotificationOptions & { vibrate?: number[]; badge?: string });
    });
  } else {
    new Notification(title, {
      icon: '/icons/icon-192x192.png',
      ...options,
    });
  }
}

let focusNotificationInterval: NodeJS.Timeout | null = null;
let isInFocusMode = false;

export function startFocusNotifications(taskName: string) {
  isInFocusMode = true;

  const handleVisibilityChange = () => {
    if (document.hidden && isInFocusMode) {
      setTimeout(() => {
        if (document.hidden && isInFocusMode) {
          sendFocusReminder(taskName);
        }
      }, 3000);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

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
  } as NotificationOptions & { requireInteraction?: boolean });
}

export function scheduleTaskReminder(taskName: string, scheduledAt: Date) {
  const now = new Date();
  const delay = scheduledAt.getTime() - now.getTime() - 5 * 60 * 1000;
  if (delay > 0) {
    setTimeout(() => {
      sendNotification('📅 タスクのお知らせ', {
        body: `5分後に「${taskName}」の時間だよ！`,
        tag: `task-${taskName}`,
      });
    }, delay);
  }
}

export function registerFocusModeWithSW(active: boolean, taskName?: string) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'FOCUS_MODE',
      active,
      taskName,
    });
  }
}
