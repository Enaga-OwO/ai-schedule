'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { getTasksLocal, updateTaskLocal } from '@/lib/db';

interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  estimatedMinutes: number;
  scheduledAt: string | null;
  createdBy: 'manual' | 'ai';
  status: 'pending' | 'in_progress' | 'done' | 'skipped';
  actualMinutes: number | null;
  completedAt: string | null;
  createdAt: string;
}

const CATEGORIES = ['全て', '勉強', '運動', '習慣', 'その他'];
const STATUS_FILTER = ['全て', 'pending', 'in_progress', 'done'];
const STATUS_LABEL: Record<string, string> = {
  pending: '未着手',
  in_progress: '進行中',
  done: '完了',
  skipped: 'スキップ',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  in_progress: 'text-blue-400 bg-blue-400/10',
  done: 'text-green-400 bg-green-400/10',
  skipped: 'text-gray-400 bg-gray-400/10',
};
const CATEGORY_EMOJI: Record<string, string> = {
  '勉強': '📚',
  '運動': '💪',
  '習慣': '🌟',
  'その他': '📌',
};

export default function TasksPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterCategory, setFilterCategory] = useState('全て');
  const [filterStatus, setFilterStatus] = useState('全て');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    category: '勉強',
    estimatedMinutes: 30,
    description: '',
    scheduledAt: '',
  });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    loadTasks();
  }, [user]);

  const loadTasks = async () => {
    // まずローカルから
    const local = await getTasksLocal();
    setTasks(local as Task[]);

    // サーバーから同期
    try {
      const res = await fetch('/api/tasks', {
        headers: { 'Authorization': `Bearer ${user?.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch {
      // ローカルデータを使用
    }
  };

  const updateStatus = async (taskId: string, status: Task['status']) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    await updateTaskLocal(taskId, { status });

    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify({ taskId, status }),
      });
    } catch {}
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    
    const task = {
      ...newTask,
      id: crypto.randomUUID(),
      createdBy: 'manual' as const,
      status: 'pending' as const,
      actualMinutes: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      scheduledAt: newTask.scheduledAt || null,
    };
    
    setTasks(prev => [task, ...prev]);
    setShowAddModal(false);
    setNewTask({ title: '', category: '勉強', estimatedMinutes: 30, description: '', scheduledAt: '' });

    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify(task),
      });
    } catch {}
  };

  const filtered = tasks.filter(t => {
    const catOk = filterCategory === '全て' || t.category === filterCategory;
    const statusOk = filterStatus === '全て' || t.status === filterStatus;
    return catOk && statusOk;
  });

  const pending = filtered.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const done = filtered.filter(t => t.status === 'done');

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-400">読み込み中...</div></div>;
  if (!user) return null;

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <header className="glass sticky top-0 z-40 safe-top px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">📋 タスク</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-primary-500 rounded-xl text-sm font-semibold transition-all active:scale-95"
        >
          ＋ 追加
        </button>
      </header>

      {/* フィルター */}
      <div className="px-4 pt-3 space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterCategory === cat
                  ? 'bg-primary-500 text-white'
                  : 'glass text-gray-400'
              }`}
            >
              {cat !== '全て' && CATEGORY_EMOJI[cat]} {cat}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {STATUS_FILTER.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs transition-all ${
                filterStatus === s ? 'bg-primary-500/30 text-primary-300' : 'glass text-gray-500'
              }`}
            >
              {s === '全て' ? '全て' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* タスクリスト */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {pending.length === 0 && done.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">📝</div>
            <p>タスクがないよ！</p>
            <p className="text-sm mt-1">AIに話しかけるか、手動で追加しよう</p>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">進行中・未着手</h2>
                {pending.map(task => (
                  <TaskCard key={task.id} task={task} onStatusChange={updateStatus} />
                ))}
              </div>
            )}
            
            {done.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">完了済み ✅</h2>
                {done.map(task => (
                  <TaskCard key={task.id} task={task} onStatusChange={updateStatus} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setShowAddModal(false)}>
          <div
            className="w-full glass rounded-t-3xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">タスクを追加</h2>
            
            <input
              type="text"
              placeholder="タスク名"
              value={newTask.title}
              onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
              className="w-full bg-white/10 rounded-xl px-4 py-3 text-sm outline-none placeholder-gray-500 border border-white/10 focus:border-primary-500/50"
            />
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">カテゴリ</label>
                <select
                  value={newTask.category}
                  onChange={e => setNewTask(p => ({ ...p, category: e.target.value }))}
                  className="w-full bg-white/10 rounded-xl px-3 py-2.5 text-sm outline-none border border-white/10"
                >
                  {['勉強', '運動', '習慣', 'その他'].map(c => (
                    <option key={c} value={c} className="bg-gray-800">{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">予定時間（分）</label>
                <input
                  type="number"
                  value={newTask.estimatedMinutes}
                  onChange={e => setNewTask(p => ({ ...p, estimatedMinutes: Number(e.target.value) }))}
                  className="w-full bg-white/10 rounded-xl px-3 py-2.5 text-sm outline-none border border-white/10"
                  min={5} max={480}
                />
              </div>
            </div>
            
            <div>
              <label className="text-xs text-gray-400 mb-1 block">予定日時（任意）</label>
              <input
                type="datetime-local"
                value={newTask.scheduledAt}
                onChange={e => setNewTask(p => ({ ...p, scheduledAt: e.target.value }))}
                className="w-full bg-white/10 rounded-xl px-3 py-2.5 text-sm outline-none border border-white/10"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 glass rounded-xl text-gray-400 font-semibold"
              >
                キャンセル
              </button>
              <button
                onClick={addTask}
                disabled={!newTask.title.trim()}
                className="flex-1 py-3 bg-primary-500 disabled:opacity-40 rounded-xl font-semibold transition-all active:scale-95"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

function TaskCard({ task, onStatusChange }: { task: Task; onStatusChange: (id: string, status: Task['status']) => void }) {
  return (
    <div className={`glass rounded-2xl p-4 transition-all ${task.status === 'done' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <button
            onClick={() => onStatusChange(task.id, task.status === 'done' ? 'pending' : 'done')}
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
              task.status === 'done'
                ? 'bg-green-500 border-green-500'
                : 'border-gray-500 hover:border-primary-500'
            }`}
          >
            {task.status === 'done' && <span className="text-white text-xs">✓</span>}
          </button>
          
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-sm ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
              {task.title}
            </p>
            {task.description && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
                {CATEGORY_EMOJI[task.category] || '📌'} {task.category}
              </span>
              <span className="text-xs text-gray-500">⏱ {task.estimatedMinutes}分</span>
              {task.scheduledAt && (
                <span className="text-xs text-gray-500">
                  📅 {new Date(task.scheduledAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                task.createdBy === 'ai' ? 'bg-purple-500/10 text-purple-400' : 'bg-gray-500/10 text-gray-400'
              }`}>
                {task.createdBy === 'ai' ? '🤖 AI作成' : '✋ 手動'}
              </span>
            </div>
          </div>
        </div>
        
        {task.status !== 'done' && (
          <select
            value={task.status}
            onChange={e => onStatusChange(task.id, e.target.value as Task['status'])}
            className="bg-transparent text-xs text-gray-400 outline-none border border-white/10 rounded-lg px-2 py-1"
          >
            <option value="pending" className="bg-gray-800">未着手</option>
            <option value="in_progress" className="bg-gray-800">進行中</option>
            <option value="done" className="bg-gray-800">完了</option>
            <option value="skipped" className="bg-gray-800">スキップ</option>
          </select>
        )}
      </div>
    </div>
  );
}
