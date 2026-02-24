'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { startFocusNotifications, stopFocusNotifications, registerFocusModeWithSW } from '@/lib/notifications';

interface TimerProps {
  initialMinutes?: number;
  label?: string;
  onComplete?: () => void;
  onStart?: () => void;
  taskName?: string;
}

export default function Timer({ initialMinutes = 25, label = '集中タイム', onComplete, onStart, taskName }: TimerProps) {
  const [totalSeconds, setTotalSeconds] = useState(initialMinutes * 60);
  const [remaining, setRemaining] = useState(initialMinutes * 60);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'focus' | 'break'>('focus');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const progress = 1 - remaining / totalSeconds;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const circumference = 2 * Math.PI * 54; // r=54
  const strokeDashoffset = circumference * (1 - progress);

  const stop = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    stopFocusNotifications();
    registerFocusModeWithSW(false);
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, []);

  const complete = useCallback(() => {
    stop();
    onComplete?.();
    
    if (phase === 'focus') {
      // 休憩タイムへ自動切替
      setPhase('break');
      const breakSeconds = 5 * 60;
      setTotalSeconds(breakSeconds);
      setRemaining(breakSeconds);
      
      // 通知
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🎉 集中タイム終了！', { body: '5分休憩しよう！よく頑張ったね！' });
      }
    } else {
      setPhase('focus');
      const focusSeconds = initialMinutes * 60;
      setTotalSeconds(focusSeconds);
      setRemaining(focusSeconds);
      
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('⏰ 休憩終了！', { body: `次の集中タイム（${initialMinutes}分）を始めよう！` });
      }
    }
  }, [stop, phase, onComplete, initialMinutes]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            complete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, complete]);

  // 外部からタイマー変更（AIによる制御）
  useEffect(() => {
    setTotalSeconds(initialMinutes * 60);
    setRemaining(initialMinutes * 60);
    setPhase('focus');
  }, [initialMinutes]);

  const handleStart = () => {
    setRunning(true);
    onStart?.();
    const cleanup = startFocusNotifications(taskName || label);
    cleanupRef.current = cleanup;
    registerFocusModeWithSW(true, taskName || label);
    
    // 通知許可リクエスト
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const reset = () => {
    stop();
    setRemaining(totalSeconds);
    setPhase('focus');
  };

  const phaseColor = phase === 'focus' ? '#6366f1' : '#10b981';
  const phaseLabel = phase === 'focus' ? label : '☕ 休憩';

  return (
    <div className="flex flex-col items-center gap-4">
      {/* フェーズ表示 */}
      <div className={`px-4 py-1 rounded-full text-sm font-medium ${
        phase === 'focus' 
          ? 'bg-primary-500/20 text-primary-300' 
          : 'bg-emerald-500/20 text-emerald-300'
      }`}>
        {phaseLabel}
      </div>

      {/* タイマーリング */}
      <div className="relative w-40 h-40">
        <svg className="w-full h-full" viewBox="0 0 120 120">
          {/* 背景リング */}
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
          {/* 進捗リング */}
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke={phaseColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="timer-ring transition-all duration-1000"
          />
        </svg>
        
        {/* 時間表示 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
          <span className="text-xs text-gray-400 mt-1">
            {running ? '集中中...' : '準備OK'}
          </span>
        </div>
      </div>

      {/* コントロール */}
      <div className="flex gap-3">
        {!running ? (
          <button
            onClick={handleStart}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 rounded-xl font-semibold transition-all active:scale-95 shadow-lg shadow-primary-500/30"
          >
            ▶ スタート
          </button>
        ) : (
          <button
            onClick={stop}
            className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl font-semibold text-red-300 transition-all active:scale-95"
          >
            ⏸ 停止
          </button>
        )}
        <button
          onClick={reset}
          className="px-4 py-3 glass rounded-xl text-gray-400 hover:text-gray-200 transition-all active:scale-95"
        >
          ↺
        </button>
      </div>
    </div>
  );
}
