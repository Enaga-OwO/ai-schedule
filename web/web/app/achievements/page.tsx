'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

interface StatsData {
  stats: { totalStudyMinutes: number; streak: number; lastActiveDate: string };
  byCategory: Record<string, { count: number; minutes: number }>;
  dailyData: Record<string, { minutes: number; tasks: number }>;
  totalCompleted: number;
  totalTasks: number;
}

const CATEGORY_EMOJI: Record<string, string> = {
  '勉強': '📚', '運動': '💪', '習慣': '🌟', 'その他': '📌',
};

export default function AchievementsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    fetchStats();
  }, [user]);

  const fetchStats = async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/stats`, {
        headers: { 'Authorization': `Bearer ${user?.token}` },
      });
      if (res.ok) setStatsData(await res.json());
    } catch {}
    setFetching(false);
  };

  const totalHours = Math.floor((statsData?.stats.totalStudyMinutes || 0) / 60);
  const totalMins = (statsData?.stats.totalStudyMinutes || 0) % 60;

  // 過去30日のバーチャート用データ
  const dailyEntries = Object.entries(statsData?.dailyData || {}).slice(-14);
  const maxMinutes = Math.max(...dailyEntries.map(([, d]) => d.minutes), 1);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-400">読み込み中...</div></div>;
  if (!user) return null;

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <header className="glass sticky top-0 z-40 safe-top px-4 py-3">
        <h1 className="text-lg font-bold">📊 実績・記録</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {fetching ? (
          <div className="flex justify-center py-16"><div className="text-gray-400">読み込み中...</div></div>
        ) : (
          <>
            {/* サマリーカード */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                emoji="🔥"
                label="連続日数"
                value={`${statsData?.stats.streak || 0}日`}
                sub="継続中"
                color="from-orange-500/20 to-red-500/20"
              />
              <StatCard
                emoji="⏱"
                label="総学習時間"
                value={`${totalHours}h ${totalMins}m`}
                sub="累計"
                color="from-blue-500/20 to-purple-500/20"
              />
              <StatCard
                emoji="✅"
                label="完了タスク"
                value={`${statsData?.totalCompleted || 0}件`}
                sub={`全${statsData?.totalTasks || 0}件`}
                color="from-green-500/20 to-emerald-500/20"
              />
              <StatCard
                emoji="📈"
                label="達成率"
                value={`${statsData?.totalTasks
                  ? Math.round((statsData.totalCompleted / statsData.totalTasks) * 100)
                  : 0}%`}
                sub="完了 / 全体"
                color="from-primary-500/20 to-pink-500/20"
              />
            </div>

            {/* 過去14日バーチャート */}
            <div className="glass rounded-2xl p-4">
              <h2 className="text-sm font-semibold mb-3 text-gray-300">📅 直近14日の学習時間</h2>
              <div className="flex items-end gap-1 h-24">
                {dailyEntries.map(([date, data]) => {
                  const height = data.minutes > 0 ? Math.max((data.minutes / maxMinutes) * 100, 8) : 0;
                  const isToday = date === new Date().toISOString().slice(0, 10);
                  return (
                    <div key={date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center" style={{ height: '88px' }}>
                        <div
                          className={`w-full rounded-t-sm transition-all ${isToday ? 'bg-primary-500' : 'bg-primary-500/40'}`}
                          style={{ height: `${height}%` }}
                          title={`${date}: ${data.minutes}分`}
                        />
                      </div>
                      <span className="text-xs text-gray-600">
                        {new Date(date).getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* カテゴリ別 */}
            {statsData?.byCategory && Object.keys(statsData.byCategory).length > 0 && (
              <div className="glass rounded-2xl p-4">
                <h2 className="text-sm font-semibold mb-3 text-gray-300">📂 カテゴリ別実績</h2>
                <div className="space-y-3">
                  {Object.entries(statsData.byCategory).map(([cat, data]) => {
                    const totalCatMin = Object.values(statsData.byCategory).reduce((s, d) => s + d.minutes, 0);
                    const pct = totalCatMin ? Math.round((data.minutes / totalCatMin) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{CATEGORY_EMOJI[cat] || '📌'} {cat}</span>
                          <span className="text-gray-400">{data.count}件 / {Math.floor(data.minutes / 60)}h{data.minutes % 60}m</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2">
                          <div
                            className="bg-primary-500 h-2 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* バッジ */}
            <div className="glass rounded-2xl p-4">
              <h2 className="text-sm font-semibold mb-3 text-gray-300">🏅 バッジ</h2>
              <div className="grid grid-cols-3 gap-3">
                <Badge emoji="🌅" label="初日" unlocked={true} />
                <Badge emoji="🔥" label="3日連続" unlocked={(statsData?.stats.streak || 0) >= 3} />
                <Badge emoji="⚡" label="7日連続" unlocked={(statsData?.stats.streak || 0) >= 7} />
                <Badge emoji="💎" label="30日連続" unlocked={(statsData?.stats.streak || 0) >= 30} />
                <Badge emoji="📚" label="10時間達成" unlocked={(statsData?.stats.totalStudyMinutes || 0) >= 600} />
                <Badge emoji="🎓" label="100時間達成" unlocked={(statsData?.stats.totalStudyMinutes || 0) >= 6000} />
                <Badge emoji="✅" label="10タスク完了" unlocked={(statsData?.totalCompleted || 0) >= 10} />
                <Badge emoji="🚀" label="50タスク完了" unlocked={(statsData?.totalCompleted || 0) >= 50} />
                <Badge emoji="👑" label="達成率80%" unlocked={
                  (statsData?.totalTasks || 0) > 10 &&
                  ((statsData?.totalCompleted || 0) / Math.max(statsData?.totalTasks || 1, 1)) >= 0.8
                } />
              </div>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function StatCard({ emoji, label, value, sub, color }: {
  emoji: string; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className={`glass rounded-2xl p-4 bg-gradient-to-br ${color}`}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-gray-500">{sub}</div>
    </div>
  );
}

function Badge({ emoji, label, unlocked }: { emoji: string; label: string; unlocked: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
      unlocked ? 'bg-primary-500/10' : 'opacity-30 grayscale'
    }`}>
      <span className="text-2xl">{emoji}</span>
      <span className="text-xs text-center text-gray-400 leading-tight">{label}</span>
    </div>
  );
}
