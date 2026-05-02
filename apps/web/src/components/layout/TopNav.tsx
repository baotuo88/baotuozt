'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

interface User {
  id: number;
  email: string;
  role: string;
  credits: number;
}

export function TopNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [showGenerateMenu, setShowGenerateMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setUser(data))
        .catch(() => localStorage.removeItem('token'));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/auth';
  };

  if (!user) return null;

  return (
    <nav className="border-b border-[#2a2a2a] bg-[#0a0a0a]">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-xl font-bold bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] bg-clip-text text-transparent">
            宝拓智图
          </Link>

          <div className="flex items-center gap-6">
            <div className="relative">
              <button
                onClick={() => setShowGenerateMenu(!showGenerateMenu)}
                className="text-[#e5e5e5] hover:text-[#8b5cf6] transition-colors font-semibold"
              >
                生成 ▼
              </button>
              {showGenerateMenu && (
                <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl py-2 min-w-[160px] shadow-lg z-50">
                  <Link href="/generate/ecommerce" className="block px-4 py-2 hover:bg-[#222] transition-colors">电商图片</Link>
                  <Link href="/generate/social" className="block px-4 py-2 hover:bg-[#222] transition-colors">社交媒体</Link>
                  <Link href="/generate/portrait" className="block px-4 py-2 hover:bg-[#222] transition-colors">AI写真</Link>
                  <Link href="/generate/general" className="block px-4 py-2 hover:bg-[#222] transition-colors">通用生成</Link>
                </div>
              )}
            </div>

            <Link href="/history" className={`font-semibold transition-colors ${pathname === '/history' ? 'text-[#8b5cf6]' : 'text-[#e5e5e5] hover:text-[#8b5cf6]'}`}>
              历史
            </Link>

            <Link href="/profile" className={`font-semibold transition-colors ${pathname === '/profile' ? 'text-[#8b5cf6]' : 'text-[#e5e5e5] hover:text-[#8b5cf6]'}`}>
              资料
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/billing" className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl font-bold text-[#8b5cf6] hover:border-[#8b5cf6] transition-colors">
            💰 {user.credits} 积分
          </Link>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl font-semibold hover:border-[#8b5cf6] transition-colors"
            >
              {user.email.split('@')[0]} ▼
            </button>
            {showUserMenu && (
              <div className="absolute top-full right-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl py-2 min-w-[160px] shadow-lg z-50">
                {user.role === 'admin' && (
                  <Link href="/admin" className="block px-4 py-2 hover:bg-[#222] transition-colors">管理后台</Link>
                )}
                <button onClick={handleLogout} className="block w-full text-left px-4 py-2 hover:bg-[#222] transition-colors text-[#ef4444]">
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
