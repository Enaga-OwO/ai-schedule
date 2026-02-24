'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await register(email, password, username);
      router.push('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 safe-top safe-bottom">
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">✨</div>
        <h1 className="text-2xl font-bold">新規登録</h1>
        <p className="text-gray-400 text-sm mt-1">一緒に習慣を変えよう！</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="text"
            placeholder="ニックネーム"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            maxLength={20}
            className="w-full glass rounded-xl px-4 py-3.5 text-sm outline-none placeholder-gray-500 border border-transparent focus:border focus:border-primary-500/50"
          />
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full glass rounded-xl px-4 py-3.5 text-sm outline-none placeholder-gray-500 border border-transparent focus:border focus:border-primary-500/50"
          />
          <input
            type="password"
            placeholder="パスワード（8文字以上）"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full glass rounded-xl px-4 py-3.5 text-sm outline-none placeholder-gray-500 border border-transparent focus:border focus:border-primary-500/50"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 rounded-xl font-bold text-base transition-all active:scale-95 shadow-lg shadow-primary-500/30"
        >
          {loading ? '登録中...' : '🚀 はじめる'}
        </button>

        <p className="text-center text-sm text-gray-400">
          すでにアカウントがある？{' '}
          <Link href="/login" className="text-primary-400 hover:text-primary-300 font-semibold">
            ログイン
          </Link>
        </p>
      </form>
    </div>
  );
}
