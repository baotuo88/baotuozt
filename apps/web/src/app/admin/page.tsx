'use client';

import { useEffect, useMemo, useState } from 'react';

type UserRole = 'user' | 'admin' | 'operator';
type UserStatus = 'active' | 'disabled' | 'banned';
type ProviderStatus = 'active' | 'inactive' | 'error';

type AdminUser = {
  id: number;
  email: string;
  role: UserRole;
  status: UserStatus;
  credits: number;
  feature_flags?: {
    show_new_feature?: boolean;
    enable_new_model?: boolean;
  };
  created_at: string;
};

type AdminTask = {
  id: number;
  user_id: number;
  mode: string;
  style_id: number;
  status: 'pending' | 'processing' | 'done' | 'failed' | 'canceled';
  progress: number;
  cancelable: boolean;
  result_url?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
};

type AdminProvider = {
  id: number;
  name: string;
  base_url: string;
  model: string;
  status: ProviderStatus;
  priority: number;
};

type AdminStats = {
  users_total: number;
  tasks_total: number;
  tasks_success_rate: number;
  usage?: {
    total_usage_count: number;
    total_credits_used: number;
    module_usage: Array<{ module: string; count: number; credits_used: number }>;
  };
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [taskLimit, setTaskLimit] = useState(100);

  const canRun = useMemo(() => Boolean(apiBase && token), [token]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const saved = window.localStorage.getItem('token') || '';
    if (saved) {
      setToken(saved);
    }
  }, []);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }),
    [token],
  );

  const fetchJson = async <T,>(path: string, options?: RequestInit): Promise<T> => {
    const resp = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        ...authHeaders,
        ...(options?.headers || {}),
      },
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`HTTP_${resp.status}:${text}`);
    }
    return (await resp.json()) as T;
  };

  const refreshAll = async () => {
    if (!canRun) {
      setError('请先填写管理员 token，且 NEXT_PUBLIC_API_BASE_URL 需要已配置。');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [statsResp, usersResp, tasksResp, providersResp] = await Promise.all([
        fetchJson<AdminStats>('/admin/stats'),
        fetchJson<AdminUser[]>('/admin/users'),
        fetchJson<AdminTask[]>(`/admin/tasks?limit=${taskLimit}`),
        fetchJson<AdminProvider[]>('/admin/api-configs'),
      ]);
      setStats(statsResp);
      setUsers(usersResp);
      setTasks(tasksResp);
      setProviders(providersResp);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const patchUserRole = async (userId: number, role: UserRole) => {
    await fetchJson(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    await refreshAll();
  };

  const patchUserStatus = async (userId: number, status: UserStatus) => {
    await fetchJson(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await refreshAll();
  };

  const adjustCredits = async (userId: number, delta: number) => {
    await fetchJson(`/admin/users/${userId}/credits`, {
      method: 'POST',
      body: JSON.stringify({ delta }),
    });
    await refreshAll();
  };

  const cancelTask = async (taskId: number) => {
    await fetchJson(`/admin/tasks/${taskId}/cancel`, {
      method: 'POST',
    });
    await refreshAll();
  };

  const toggleProviderStatus = async (provider: AdminProvider) => {
    const nextStatus: ProviderStatus = provider.status === 'active' ? 'inactive' : 'active';
    await fetchJson(`/admin/model-providers/${provider.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await refreshAll();
  };

  return (
    <main style={{ padding: 20, display: 'grid', gap: 16 }}>
      <h1>Admin Console</h1>

      <section style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <label htmlFor="token">Admin JWT Token</label>
          <textarea
            id="token"
            rows={3}
            value={token}
            onChange={(e) => setToken(e.target.value.trim())}
            placeholder="粘贴管理员 JWT"
          />
          <label htmlFor="taskLimit">Task Limit</label>
          <input
            id="taskLimit"
            type="number"
            min={1}
            max={500}
            value={taskLimit}
            onChange={(e) => setTaskLimit(Number(e.target.value) || 100)}
          />
          <button onClick={() => void refreshAll()} disabled={loading || !token}>
            {loading ? 'Loading...' : 'Refresh Dashboard'}
          </button>
          {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
        </div>
      </section>

      <section style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
        <h2>Stats</h2>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(stats, null, 2)}</pre>
      </section>

      <section style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
        <h2>Users</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Credits</th>
                <th>Feature Flags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.status}</td>
                  <td>{user.credits}</td>
                  <td>{JSON.stringify(user.feature_flags || {})}</td>
                  <td>
                    <button onClick={() => void patchUserRole(user.id, user.role === 'admin' ? 'user' : 'admin')}>
                      Toggle Admin
                    </button>{' '}
                    <button
                      onClick={() =>
                        void patchUserStatus(
                          user.id,
                          user.status === 'active' ? 'disabled' : 'active',
                        )
                      }
                    >
                      Toggle Active
                    </button>{' '}
                    <button onClick={() => void adjustCredits(user.id, 10)}>+10</button>{' '}
                    <button onClick={() => void adjustCredits(user.id, -10)}>-10</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
        <h2>Tasks</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.id}</td>
                  <td>{task.user_id}</td>
                  <td>{task.mode}</td>
                  <td>{task.status}</td>
                  <td>{task.progress}</td>
                  <td>{task.updated_at}</td>
                  <td>
                    <button
                      onClick={() => void cancelTask(task.id)}
                      disabled={task.status !== 'pending' && task.status !== 'processing'}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
        <h2>Model Providers</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Base URL</th>
                <th>Model</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.id}>
                  <td>{provider.id}</td>
                  <td>{provider.name}</td>
                  <td>{provider.base_url}</td>
                  <td>{provider.model}</td>
                  <td>{provider.status}</td>
                  <td>{provider.priority}</td>
                  <td>
                    <button onClick={() => void toggleProviderStatus(provider)}>Toggle Status</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
