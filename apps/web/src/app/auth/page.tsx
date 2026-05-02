'use client';

import { useMemo, useState } from 'react';

type AuthResp = {
  token: string;
  user: {
    id: number;
    email: string;
    role: 'user' | 'admin' | 'operator';
    status: 'active' | 'disabled' | 'banned';
    credits: number;
  };
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const endpoint = useMemo(() => (mode === 'login' ? '/auth/login' : '/auth/register'), [mode]);

  const submit = async () => {
    setMessage('');
    if (!apiBase) {
      setMessage('缺少 NEXT_PUBLIC_API_BASE_URL 配置');
      return;
    }
    if (!email.trim() || !password.trim()) {
      setMessage('邮箱和密码不能为空');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });

      const text = await resp.text();
      if (!resp.ok) {
        setMessage(`失败：${text}`);
        return;
      }

      const data = JSON.parse(text) as AuthResp;
      if (!data?.token) {
        setMessage('接口返回缺少 token');
        return;
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.token);
      }
      setMessage(`成功：${mode === 'login' ? '登录' : '注册'}完成，角色=${data.user.role}，已写入 localStorage token`);

      // 跳转到工作台
      setTimeout(() => {
        window.location.href = '/workspace';
      }, 1000);
    } catch (error) {
      setMessage(`请求异常：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    setMessage('已退出登录，本地 token 已清除');
  };

  return (
    <main className="home" style={{ maxWidth: 560 }}>
      <section className="hero">
        <p className="tag">账号系统</p>
        <h1>{mode === 'login' ? '登录账号' : '注册账号'}</h1>
        <p>登录或注册后即可开始使用 AI 生图服务</p>
      </section>

      <section className="entry-card" style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setMode('login')}
            type="button"
            style={{
              flex: 1,
              background: mode === 'login' ? 'linear-gradient(135deg, var(--accent), var(--accent-hover))' : 'var(--card)',
              color: mode === 'login' ? '#fff' : 'var(--ink)',
              border: mode === 'login' ? 'none' : '1px solid var(--line)'
            }}
          >
            登录
          </button>
          <button
            onClick={() => setMode('register')}
            type="button"
            style={{
              flex: 1,
              background: mode === 'register' ? 'linear-gradient(135deg, var(--accent), var(--accent-hover))' : 'var(--card)',
              color: mode === 'register' ? '#fff' : 'var(--ink)',
              border: mode === 'register' ? 'none' : '1px solid var(--line)'
            }}
          >
            注册
          </button>
        </div>

        <label htmlFor="email">
          邮箱地址
          <input
            id="email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label htmlFor="password">
          密码（至少 6 位）
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button type="button" onClick={() => void submit()} disabled={loading}>
          {loading ? (
            <>
              <span className="spinner" style={{ marginRight: 8 }}></span>
              {mode === 'login' ? '登录中...' : '注册中...'}
            </>
          ) : (
            mode === 'login' ? '登录' : '注册'
          )}
        </button>

        <button
          type="button"
          onClick={logout}
          style={{
            background: 'var(--card)',
            color: 'var(--ink-secondary)',
            border: '1px solid var(--line)'
          }}
        >
          退出登录
        </button>

        {message ? (
          <div style={{
            padding: '12px 16px',
            background: message.includes('成功') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${message.includes('成功') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '12px',
            color: message.includes('成功') ? '#10b981' : '#ef4444',
            fontSize: '14px',
            lineHeight: '1.6'
          }}>
            {message}
          </div>
        ) : null}
      </section>
    </main>
  );
}
