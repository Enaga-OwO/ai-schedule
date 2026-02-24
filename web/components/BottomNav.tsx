'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/chat', icon: '💬', label: 'AI会話' },
  { href: '/tasks', icon: '📋', label: 'タスク' },
  { href: '/achievements', icon: '📊', label: '実績' },
  { href: '/settings', icon: '⚙️', label: '設定' },
];

export default function BottomNav() {
  const pathname = usePathname();
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 glass safe-bottom z-50">
      <div className="flex items-center justify-around py-2">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                active
                  ? 'text-primary-500 bg-primary-500/10'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
