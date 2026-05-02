'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

interface Task {
  id: number;
  mode: string;
  status: string;
  result_url?: string;
  created_at: string;
}

export default function HistoryPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modeFilter, setModeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const limit = 24;

  useEffect(() => {
    loadTasks();
  }, [modeFilter, statusFilter, page]);

  const loadTasks = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });
      if (modeFilter !== 'all') params.append('mode', modeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/tasks/history?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTasks(data);
      setHasMore(data.length === limit);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const modeNames: Record<string, string> = {
    ecommerce: '电商图片',
    social: '社交媒体',
    portrait: 'AI写真',
    general: '通用生成'
  };

  const statusNames: Record<string, string> = {
    pending: '排队中',
    processing: '处理中',
    done: '已完成',
    failed: '失败',
    canceled: '已取消'
  };

  const statusColors: Record<string, string> = {
    pending: 'text-[#f59e0b]',
    processing: 'text-[#06b6d4]',
    done: 'text-[#10b981]',
    failed: 'text-[#ef4444]',
    canceled: 'text-[#a3a3a3]'
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-[1400px] mx-auto px-6 py-12">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] bg-clip-text text-transparent">
            生成历史
          </h1>

          <Card className="mb-6">
            <div className="flex gap-4 flex-wrap">
              <Select
                label="模式筛选"
                value={modeFilter}
                onChange={(e) => {
                  setModeFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">全部模式</option>
                <option value="ecommerce">电商图片</option>
                <option value="social">社交媒体</option>
                <option value="portrait">AI写真</option>
                <option value="general">通用生成</option>
              </Select>

              <Select
                label="状态筛选"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">全部状态</option>
                <option value="done">已完成</option>
                <option value="processing">处理中</option>
                <option value="pending">排队中</option>
                <option value="failed">失败</option>
                <option value="canceled">已取消</option>
              </Select>
            </div>
          </Card>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-[#2a2a2a] border-t-[#8b5cf6] rounded-full" />
            </div>
          ) : tasks.length === 0 ? (
            <Card>
              <p className="text-center text-[#a3a3a3] py-12">暂无生成记录</p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
                {tasks.map(task => (
                  <div key={task.id} className="group">
                    <Link href={task.result_url ? `/image/${task.id}` : '#'} className="block">
                      <div className="aspect-square bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#8b5cf6] transition-all">
                        {task.result_url ? (
                          <img src={task.result_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#a3a3a3] text-sm">
                            {statusNames[task.status] || task.status}
                          </div>
                        )}
                      </div>
                    </Link>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-semibold">{modeNames[task.mode] || task.mode}</p>
                      <p className={`text-xs ${statusColors[task.status] || 'text-[#a3a3a3]'}`}>
                        {statusNames[task.status] || task.status}
                      </p>
                      <p className="text-xs text-[#a3a3a3]">
                        {new Date(task.created_at).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-center gap-4">
                <Button
                  variant="secondary"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  上一页
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasMore}
                >
                  下一页
                </Button>
              </div>
            </>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
