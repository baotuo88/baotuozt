'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface User {
  id: number;
  email: string;
  role: string;
  credits: number;
  created_at: string;
}

interface Task {
  id: number;
  mode: string;
  status: string;
  result_url?: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth');
      return;
    }

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/tasks/history?limit=6`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.json())
    ])
      .then(([userData, tasksData]) => {
        setUser(userData);
        setRecentTasks(tasksData);
      })
      .catch(() => {
        localStorage.removeItem('token');
        router.push('/auth');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#2a2a2a] border-t-[#8b5cf6] rounded-full" />
      </div>
    );
  }

  const modeNames: Record<string, string> = {
    ecommerce: '电商图片',
    social: '社交媒体',
    portrait: 'AI写真',
    general: '通用生成'
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-[1400px] mx-auto px-6 py-12">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] bg-clip-text text-transparent">
            欢迎回来，{user?.email.split('@')[0]}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <Card>
              <h3 className="text-sm text-[#a3a3a3] mb-2">账户积分</h3>
              <p className="text-3xl font-bold text-[#8b5cf6]">{user?.credits}</p>
              <Link href="/billing" className="text-sm text-[#06b6d4] hover:underline mt-2 inline-block">
                充值积分 →
              </Link>
            </Card>

            <Card>
              <h3 className="text-sm text-[#a3a3a3] mb-2">账户角色</h3>
              <p className="text-2xl font-bold">{user?.role === 'admin' ? '管理员' : '普通用户'}</p>
            </Card>

            <Card>
              <h3 className="text-sm text-[#a3a3a3] mb-2">注册时间</h3>
              <p className="text-lg">{user?.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '-'}</p>
            </Card>
          </div>

          <h2 className="text-2xl font-bold mb-6">快速开始</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            <Link href="/generate/ecommerce" className="block">
              <Card className="hover:border-[#8b5cf6] transition-all cursor-pointer h-full">
                <h3 className="text-xl font-bold mb-2">🛍️ 电商图片</h3>
                <p className="text-sm text-[#a3a3a3]">生成商品主图、详情图</p>
              </Card>
            </Link>

            <Link href="/generate/social" className="block">
              <Card className="hover:border-[#8b5cf6] transition-all cursor-pointer h-full">
                <h3 className="text-xl font-bold mb-2">📱 社交媒体</h3>
                <p className="text-sm text-[#a3a3a3]">小红书、抖音封面</p>
              </Card>
            </Link>

            <Link href="/generate/portrait" className="block">
              <Card className="hover:border-[#8b5cf6] transition-all cursor-pointer h-full">
                <h3 className="text-xl font-bold mb-2">👤 AI写真</h3>
                <p className="text-sm text-[#a3a3a3]">生成专业证件照</p>
              </Card>
            </Link>

            <Link href="/generate/general" className="block">
              <Card className="hover:border-[#8b5cf6] transition-all cursor-pointer h-full">
                <h3 className="text-xl font-bold mb-2">🎨 通用生成</h3>
                <p className="text-sm text-[#a3a3a3]">自由创作图片</p>
              </Card>
            </Link>
          </div>

          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">最近生成</h2>
            <Link href="/history" className="text-[#8b5cf6] hover:underline">
              查看全部 →
            </Link>
          </div>

          {recentTasks.length === 0 ? (
            <Card>
              <p className="text-center text-[#a3a3a3] py-8">还没有生成记录，开始创作吧！</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {recentTasks.map(task => (
                <Link key={task.id} href={task.result_url ? `/image/${task.id}` : '#'} className="block">
                  <div className="aspect-square bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#8b5cf6] transition-all">
                    {task.result_url ? (
                      <img src={task.result_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#a3a3a3] text-sm">
                        {task.status === 'processing' ? '生成中...' : task.status === 'failed' ? '失败' : '等待中'}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#a3a3a3] mt-2">{modeNames[task.mode] || task.mode}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
