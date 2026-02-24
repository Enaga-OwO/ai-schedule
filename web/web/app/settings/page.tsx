'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { requestNotificationPermission } from '@/lib/notifications';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [lineCode, setLineCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [notifStatus, setNotifStatus] = useState<string>('');

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleNotificationRequest = async () => {
    const granted = await requestNotificationPermission();
    setNotifStatus(granted ? '通知が許可されました ✅' : '通知が拒否されています ❌');
  };

  const handleLineLinking = async () => {
    if (!lineCode.trim() || !user) return;
    setLinking(true);
    
    try {
      // LINEのリンクコードをPHPサーバーに送信
      // 実際の実装ではLINEのLIFFを使用してlineUserIdを取得する
      const res = await fetch('/api/line-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({ linkCode: lineCode }),
      });
      
      if (res.ok) {
        setLinkSuccess(true);
      }
    } catch {}
    setLinking(false);
  };

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <header className="glass sticky top-0 z-40 safe-top px-4 py-3">
        <h1 className="text-lg font-bold">⚙️ 設定</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* プロフィール */}
        <div className="glass rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">👤 プロフィール</h2>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-500/20 flex items-center justify-center text-2xl">
              {user?.username?.[0] || '?'}
            </div>
            <div>
              <div className="font-semibold">{user?.username}</div>
              <div className="text-sm text-gray-400">{user?.email}</div>
            </div>
          </div>
        </div>

        {/* LINE連携 */}
        <div className="glass rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">💚 LINE連携</h2>
          
          {linkSuccess ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-green-400 font-semibold">LINE連携完了！</p>
              <p className="text-xs text-gray-400 mt-1">LINEからもAIと話せるよ</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 leading-relaxed">
                LINE Botを友達追加して、チャットで「連携コード」と送ると、
                コードが届きます。そのコードを入力してね。
              </p>
              <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                <span className="text-green-400 text-lg">📱</span>
                <div>
                  <div className="text-sm font-medium text-green-400">LINE Bot</div>
                  <div className="text-xs text-gray-400">@your-bot-id を検索して友達追加</div>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="連携コードを入力..."
                  value={lineCode}
                  onChange={e => setLineCode(e.target.value)}
                  className="flex-1 bg-white/10 rounded-xl px-3 py-2.5 text-sm outline-none border border-white/10 focus:border-primary-500/50"
                />
                <button
                  onClick={handleLineLinking}
                  disabled={linking || !lineCode.trim()}
                  className="px-4 py-2.5 bg-green-500 disabled:opacity-40 rounded-xl text-sm font-semibold transition-all active:scale-95"
                >
                  {linking ? '...' : '連携'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 通知設定 */}
        <div className="glass rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">🔔 通知</h2>
          <div className="space-y-3">
            <p className="text-xs text-gray-400">
              集中タイム中にアプリを閉じると通知でリマインドします。
              まず通知を許可してください。
            </p>
            <button
              onClick={handleNotificationRequest}
              className="w-full py-3 glass rounded-xl text-sm font-semibold text-gray-300 hover:text-white transition-all active:scale-95"
            >
              🔔 通知を許可する
            </button>
            {notifStatus && (
              <p className="text-xs text-center text-gray-400">{notifStatus}</p>
            )}
            
            <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
              <p className="text-xs text-yellow-400 font-medium">📱 iOS について</p>
              <p className="text-xs text-gray-400 mt-1">
                iPhoneではPWAのバックグラウンド通知に制限があります。
                アクセスガイド使用中は通知が届きにくい場合があります。
                Androidでは問題なく動作します。
              </p>
            </div>
          </div>
        </div>

        {/* 使い方のヒント */}
        <div className="glass rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">💡 使い方ヒント</h2>
          <div className="space-y-2 text-xs text-gray-400">
            <p>📱 <span className="text-gray-300">スマホのホーム画面に追加</span>するとアプリのように使えます</p>
            <p>🤖 AIに「<span className="text-gray-300">今日の勉強計画立てて</span>」と話しかけるとスケジューリングしてくれます</p>
            <p>⏱ <span className="text-gray-300">「集中タイム始めよう」</span>と言うとタイマーが自動でセットされます</p>
            <p>📴 <span className="text-gray-300">オフライン</span>でもタスク確認や入力の一部ができます</p>
            <p>💚 <span className="text-gray-300">LINE</span>でも同じAIと話せて、会話が同期されます</p>
          </div>
        </div>

        {/* ログアウト */}
        <button
          onClick={handleLogout}
          className="w-full py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 font-semibold hover:bg-red-500/20 transition-all active:scale-95"
        >
          ログアウト
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
