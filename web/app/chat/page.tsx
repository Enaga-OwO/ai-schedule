'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Timer from '@/components/Timer';
import BottomNav from '@/components/BottomNav';
import {
  saveConversationLocal,
  getConversationsLocal,
  saveTaskLocal,
  savePendingMessage,
  getAndClearPendingMessages,
} from '@/lib/db';
import { requestNotificationPermission } from '@/lib/notifications';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface TimerConfig {
  minutes: number;
  label: string;
}

const QUICK_REPLIES = [
  '勉強やる気が出ない😩',
  '今日のスケジュール立てて',
  '集中タイム始めよう',
  '昨日の振り返り',
  'タスク追加したい',
];

export default function ChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [timerConfig, setTimerConfig] = useState<TimerConfig | null>(null);
  const [showTimer, setShowTimer] = useState(false);
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingMessages();
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 初期化：ローカルDBから会話ロード
  useEffect(() => {
    if (!user) return;
    
    const loadMessages = async () => {
      const local = await getConversationsLocal(50);
      
      if (local.length > 0) {
        setMessages(local.map(c => ({
          id: c.id,
          role: c.role,
          content: c.content,
          timestamp: c.timestamp,
        })));
      } else {
        // 初回挨拶
        const greeting: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: `やあ、${user.username}！👋 今日も一緒に頑張ろう！\n\n何から始める？勉強の予定を立てたり、やる気が出ない時の相談もOKだよ😊`,
          timestamp: new Date().toISOString(),
        };
        setMessages([greeting]);
        await saveConversationLocal({ ...greeting, source: 'web', synced: false });
      }
      
      // 通知許可リクエスト
      requestNotificationPermission();
    };
    
    loadMessages();
  }, [user]);

  // スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // オフラインメッセージの同期
  const syncPendingMessages = useCallback(async () => {
    if (!user) return;
    const pending = await getAndClearPendingMessages();
    if (pending.length === 0) return;
    
    for (const msg of pending) {
      await sendMessageToAPI(msg.content, messages);
    }
  }, [user, messages]);

  const sendMessageToAPI = async (
    content: string,
    currentHistory: Message[]
  ): Promise<void> => {
    const history = currentHistory
      .slice(-20)
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user?.token}`,
      },
      body: JSON.stringify({ message: content, history }),
    });

    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();

    const aiMsg: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: data.text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, aiMsg]);
    await saveConversationLocal({ ...aiMsg, source: 'web', synced: true });

    // タイマー設定（AIから指示された場合）
    if (data.timerJson) {
      setTimerConfig(data.timerJson as TimerConfig);
      setShowTimer(true);
    }

    // タスク追加
    if (data.taskJson && user) {
      const task = {
        ...data.taskJson,
        id: uuidv4(),
        status: 'pending' as const,
        createdBy: 'ai' as const,
        actualMinutes: null,
        completedAt: null,
        createdAt: new Date().toISOString(),
        synced: false,
      };
      await saveTaskLocal(task as Parameters<typeof saveTaskLocal>[0]);
      setCurrentTask((data.taskJson as { title: string }).title);

      // サーバーに同期
      fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({ ...data.taskJson, createdBy: 'ai' }),
      }).catch(() => {});
    }
  };

  const sendMessage = async (content?: string) => {
    const text = content || input.trim();
    if (!text || sending) return;
    
    setInput('');
    setSending(true);

    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    await saveConversationLocal({ ...userMsg, source: 'web', synced: false });

    if (!isOnline) {
      // オフライン時は保存して後で送信
      await savePendingMessage({ ...userMsg });
      const offlineMsg: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: '今はオフラインだよ📴 オンラインになったら返事するね！',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, offlineMsg]);
      setSending(false);
      return;
    }

    try {
      await sendMessageToAPI(text, [...messages, userMsg]);
    } catch (error) {
      const errorMsg: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: 'ごめん、ちょっとエラーが出ちゃった😅 もう一度試してみて！',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* ヘッダー */}
      <header className="glass sticky top-0 z-40 safe-top px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-500/20 flex items-center justify-center text-lg">🤖</div>
          <div>
            <div className="font-semibold text-sm">生活改善AI</div>
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-500'}`} />
              <span className="text-xs text-gray-400">{isOnline ? 'オンライン' : 'オフライン'}</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setShowTimer(!showTimer)}
          className={`p-2 rounded-xl transition-all ${showTimer ? 'bg-primary-500/20 text-primary-300' : 'glass text-gray-400'}`}
        >
          ⏱
        </button>
      </header>

      {/* タイマーパネル */}
      {showTimer && (
        <div className="glass mx-4 mt-3 p-4 rounded-2xl fade-in-up">
          <Timer
            initialMinutes={timerConfig?.minutes || 25}
            label={timerConfig?.label || '集中タイム'}
            taskName={currentTask || undefined}
            onComplete={() => {
              setTimerConfig(null);
              sendMessage('タイマーが終わったよ！どうだった？');
            }}
          />
        </div>
      )}

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className={`flex fade-in-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0">
                🤖
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user' ? 'bubble-user' : 'bubble-ai'
              }`}
            >
              {msg.content}
              <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/50' : 'text-gray-500'}`}>
                {new Date(msg.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {/* タイピングインジケーター */}
        {sending && (
          <div className="flex justify-start fade-in-up">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-sm mr-2 flex-shrink-0">🤖</div>
            <div className="bubble-ai px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <div className="w-2 h-2 rounded-full bg-gray-400 typing-dot" />
                <div className="w-2 h-2 rounded-full bg-gray-400 typing-dot" />
                <div className="w-2 h-2 rounded-full bg-gray-400 typing-dot" />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* クイックリプライ */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {QUICK_REPLIES.map(reply => (
          <button
            key={reply}
            onClick={() => sendMessage(reply)}
            className="flex-shrink-0 px-3 py-2 glass rounded-full text-xs text-gray-300 hover:text-white hover:border-primary-500/50 transition-all active:scale-95"
          >
            {reply}
          </button>
        ))}
      </div>

      {/* 入力エリア */}
      <div className="px-4 pb-2 safe-bottom">
        <div className="flex gap-2 items-end glass rounded-2xl p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="AIに話しかける..."
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none outline-none max-h-32 min-h-[40px] py-2 px-2"
            rows={1}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-xl bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
          >
            <span className="text-lg">↑</span>
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
