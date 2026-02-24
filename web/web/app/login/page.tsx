'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(email, password);
      router.push('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 safe-top safe-bottom">
      {/* ロゴ */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">🤖</div>
        <h1 className="text-2xl font-bold">生活改善AI</h1>
        <p className="text-gray-400 text-sm mt-1">AIと一緒に習慣を変えよう</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full glass rounded-xl px-4 py-3.5 text-sm outline-none placeholder-gray-500 focus:border-primary-500/50 border border-transparent focus:border"
          />
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full glass rounded-xl px-4 py-3.5 text-sm outline-none placeholder-gray-500 focus:border-primary-500/50 border border-transparent focus:border"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 rounded-xl font-bold text-base transition-all active:scale-95 shadow-lg shadow-primary-500/30"
        >
          {loading ? '...' : 'ログイン'}
        </button>

        <p className="text-center text-sm text-gray-400">
          アカウントがない？{' '}
          <Link href="/register" className="text-primary-400 hover:text-primary-300 font-semibold">
            新規登録
          </Link>
        </p>
      </form>

      {/* 特徴紹介 */}
      <div className="mt-12 w-full max-w-sm space-y-2">
        {[
          ['💬', 'AIとリアルタイム対話'],
          ['📋', 'スケジュール自動作成'],
          ['⏱', '集中タイマー機能'],
          ['💚', 'LINE連携対応'],
          ['📴', '一部オフライン動作'],
        ].map(([emoji, text]) => (
          <div key={text} className="flex items-center gap-3 text-sm text-gray-400">
            <span className="text-lg">{emoji}</span>
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}
