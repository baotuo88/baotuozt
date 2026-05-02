'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface User {
  credits: number;
}

interface Order {
  order_no: string;
  amount: number;
  credits: number;
  status: string;
  created_at: string;
}

export default function BillingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/billing/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.json())
    ])
      .then(([userData, ordersData]) => {
        setUser(userData);
        setOrders(ordersData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (credits: number, amount: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/billing/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ credits, amount })
      });

      const data = await res.json();
      alert(`订单创建成功！订单号：${data.order_no}`);
      window.location.reload();
    } catch (error) {
      alert('创建订单失败，请稍后重试');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#2a2a2a] border-t-[#8b5cf6] rounded-full" />
      </div>
    );
  }

  const packages = [
    { credits: 100, amount: 10, label: '入门套餐' },
    { credits: 500, amount: 45, label: '标准套餐', popular: true },
    { credits: 1000, amount: 80, label: '专业套餐' },
    { credits: 5000, amount: 350, label: '企业套餐' },
  ];

  const statusNames: Record<string, string> = {
    pending: '待支付',
    paid: '已支付',
    canceled: '已取消'
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-[1200px] mx-auto px-6 py-12">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] bg-clip-text text-transparent">
            积分充值
          </h1>

          <Card className="mb-8">
            <h2 className="text-2xl font-bold mb-2">当前积分</h2>
            <p className="text-4xl font-bold text-[#8b5cf6]">{user?.credits}</p>
          </Card>

          <h2 className="text-2xl font-bold mb-6">充值套餐</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {packages.map(pkg => (
              <Card key={pkg.credits} className={`relative ${pkg.popular ? 'border-[#8b5cf6]' : ''}`}>
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#8b5cf6] text-white px-3 py-1 rounded-full text-xs font-bold">
                    推荐
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2">{pkg.label}</h3>
                <p className="text-3xl font-bold text-[#8b5cf6] mb-1">{pkg.credits}</p>
                <p className="text-sm text-[#a3a3a3] mb-4">积分</p>
                <p className="text-2xl font-bold mb-4">¥{pkg.amount}</p>
                <Button
                  onClick={() => handlePurchase(pkg.credits, pkg.amount)}
                  className="w-full"
                  variant={pkg.popular ? 'primary' : 'secondary'}
                >
                  立即购买
                </Button>
              </Card>
            ))}
          </div>

          <h2 className="text-2xl font-bold mb-6">充值记录</h2>
          {orders.length === 0 ? (
            <Card>
              <p className="text-center text-[#a3a3a3] py-8">暂无充值记录</p>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2a2a2a]">
                      <th className="text-left py-3 px-4 text-[#a3a3a3] font-semibold">订单号</th>
                      <th className="text-left py-3 px-4 text-[#a3a3a3] font-semibold">积分</th>
                      <th className="text-left py-3 px-4 text-[#a3a3a3] font-semibold">金额</th>
                      <th className="text-left py-3 px-4 text-[#a3a3a3] font-semibold">状态</th>
                      <th className="text-left py-3 px-4 text-[#a3a3a3] font-semibold">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr key={order.order_no} className="border-b border-[#2a2a2a]">
                        <td className="py-3 px-4 font-mono text-sm">{order.order_no}</td>
                        <td className="py-3 px-4">{order.credits}</td>
                        <td className="py-3 px-4">¥{order.amount}</td>
                        <td className="py-3 px-4">{statusNames[order.status] || order.status}</td>
                        <td className="py-3 px-4 text-sm text-[#a3a3a3]">
                          {new Date(order.created_at).toLocaleString('zh-CN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
