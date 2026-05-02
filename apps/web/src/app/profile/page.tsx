'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';

interface User {
  id: number;
  email: string;
  role: string;
  status: string;
  credits: number;
  created_at: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#2a2a2a] border-t-[#8b5cf6] rounded-full" />
      </div>
    );
  }

  const roleNames: Record<string, string> = {
    user: '普通用户',
    admin: '管理员',
    operator: '运营人员'
  };

  const statusNames: Record<string, string> = {
    active: '正常',
    disabled: '已禁用',
    banned: '已封禁'
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-[800px] mx-auto px-6 py-12">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] bg-clip-text text-transparent">
            个人资料
          </h1>

          <Card className="space-y-6">
            <div>
              <h3 className="text-sm text-[#a3a3a3] mb-2">用户ID</h3>
              <p className="text-lg font-mono">{user?.id}</p>
            </div>

            <div>
              <h3 className="text-sm text-[#a3a3a3] mb-2">邮箱地址</h3>
              <p className="text-lg">{user?.email}</p>
            </div>

            <div>
              <h3 className="text-sm text-[#a3a3a3] mb-2">账户角色</h3>
              <p className="text-lg">{roleNames[user?.role || ''] || user?.role}</p>
            </div>

            <div>
              <h3 className="text-sm text-[#a3a3a3] mb-2">账户状态</h3>
              <p className="text-lg">{statusNames[user?.status || ''] || user?.status}</p>
            </div>

            <div>
              <h3 className="text-sm text-[#a3a3a3] mb-2">当前积分</h3>
              <p className="text-2xl font-bold text-[#8b5cf6]">{user?.credits}</p>
            </div>

            <div>
              <h3 className="text-sm text-[#a3a3a3] mb-2">注册时间</h3>
              <p className="text-lg">
                {user?.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : '-'}
              </p>
            </div>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
