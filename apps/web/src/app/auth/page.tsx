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

      localStorage.setItem('token', data.token);
      setMessage(`成功：${mode === 'login' ? '登录' : '注册'}完成，角色=${data.user.role}，已写入 localStorage token`);
    } catch (error) {
      setMessage(`请求异常：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setMessage('已退出登录，本地 token 已清除');
  };

  return (
    <main className="home" style={{ maxWidth: 560 }}>
      <section className="hero">
        <p className="tag">账号系统</p>
        <h1>{mode === 'login' ? '登录' : '注册'}</h1>
        <p>注册/登录成功后会自动写入 token，可直接进入工作台和管理后台。</p>
      </section>

      <section className="entry-card" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode('login')} type="button" style={{ flex: 1 }}>
            登录
          </button>
          <button onClick={() => setMode('register')} type="button" style={{ flex: 1 }}>
            注册
          </button>
        </div>

        <label htmlFor="email">
          邮箱
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label htmlFor="password">
          密码（至少6位）
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button type="button" onClick={() => void submit()} disabled={loading}>
          {loading ? '提交中...' : mode === 'login' ? '登录' : '注册'}
        </button>
        <button type="button" onClick={logout}>
          退出登录
        </button>

        {message ? <p style={{ margin: 0, color: '#6d5c47' }}>{message}</p> : null}
      </section>
    </main>
  );
}
