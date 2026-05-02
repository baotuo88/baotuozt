'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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

type RequestLog = {
  id: number;
  user_id?: number | null;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  created_at: string;
};

type ErrorLog = {
  id: number;
  user_id?: number | null;
  task_id?: number | null;
  source: string;
  code: string;
  message: string;
  created_at: string;
};

type ApiCallLog = {
  id: number;
  user_id?: number | null;
  task_id?: number | null;
  provider: string;
  endpoint: string;
  status: 'success' | 'failed';
  latency_ms: number;
  error_message?: string;
  created_at: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const adminAccessCode = process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE || '';
type AdminPanel = 'stats' | 'users' | 'tasks' | 'providers' | 'logs';

function toQueryRole(value: 'all' | UserRole): string {
  return value === 'all' ? '' : value;
}

function toQueryStatus(value: 'all' | UserStatus): string {
  return value === 'all' ? '' : value;
}

export default function AdminConsole(props: { initialPanel?: AdminPanel }) {
  const [panel, setPanel] = useState<AdminPanel>(props.initialPanel ?? 'stats');
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [accessGranted, setAccessGranted] = useState(false);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [taskLimit, setTaskLimit] = useState(100);
  const [userKeyword, setUserKeyword] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | UserRole>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | UserStatus>('all');
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(20);
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [apiCallLogs, setApiCallLogs] = useState<ApiCallLog[]>([]);
  const [logsLimit, setLogsLimit] = useState(50);
  const [providerForm, setProviderForm] = useState({
    name: '',
    base_url: '',
    api_key: '',
    model_type: 'gpt-image-1',
    priority: 100,
    status: 'active' as ProviderStatus,
  });

  useEffect(() => {
    if (!token) {
      return;
    }
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPage, userPageSize]);

  const canRun = useMemo(() => Boolean(apiBase && token), [token]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin_access_granted');
    setToken('');
    setError('已退出登录，本地 token 已清除。');
    setAccessGranted(false);
  };

  const verifyAccessCode = () => {
    if (!adminAccessCode) {
      setAccessGranted(true);
      localStorage.setItem('admin_access_granted', '1');
      return;
    }
    if (accessCodeInput.trim() !== adminAccessCode) {
      setError('后台访问码错误');
      return;
    }
    setError('');
    setAccessGranted(true);
    localStorage.setItem('admin_access_granted', '1');
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const saved = window.localStorage.getItem('token') || '';
    if (saved) {
      setToken(saved);
    }
    const granted = window.localStorage.getItem('admin_access_granted') === '1';
    if (granted || !adminAccessCode) {
      setAccessGranted(true);
    }
  }, []);

  if (!accessGranted) {
    return (
      <main style={{ maxWidth: 520, margin: '48px auto', padding: 20, display: 'grid', gap: 12 }}>
        <h1>后台访问验证</h1>
        <p>请输入后台访问码后继续。</p>
        <input
          type="password"
          value={accessCodeInput}
          onChange={(e) => setAccessCodeInput(e.target.value)}
          placeholder="请输入后台访问码"
        />
        <button onClick={verifyAccessCode}>进入后台</button>
        {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      </main>
    );
  }

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
        fetchJson<AdminUser[]>(
          `/admin/users?keyword=${encodeURIComponent(userKeyword)}&role=${toQueryRole(userRoleFilter)}&status=${toQueryStatus(userStatusFilter)}&limit=${userPageSize}&offset=${(userPage - 1) * userPageSize}`,
        ),
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

  const refreshLogs = async () => {
    if (!canRun) {
      setError('请先填写管理员 token，且 NEXT_PUBLIC_API_BASE_URL 需要已配置。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [r1, r2, r3] = await Promise.all([
        fetchJson<RequestLog[]>(`/logs/requests?limit=${logsLimit}`),
        fetchJson<ErrorLog[]>(`/logs/errors?limit=${logsLimit}`),
        fetchJson<ApiCallLog[]>(`/logs/api-calls?limit=${logsLimit}`),
      ]);
      setRequestLogs(r1);
      setErrorLogs(r2);
      setApiCallLogs(r3);
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

  const saveProvider = async (provider: AdminProvider) => {
    const baseUrl = window.prompt('Base URL', provider.base_url);
    if (!baseUrl) {
      return;
    }
    const apiKey = window.prompt('API Key（留空不修改）', '');
    const priorityRaw = window.prompt('Priority', String(provider.priority));
    const priority = Number(priorityRaw ?? provider.priority);
    if (!Number.isInteger(priority)) {
      setError('priority 必须是整数');
      return;
    }

    await fetchJson(`/admin/model-providers/${provider.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        base_url: baseUrl.trim(),
        api_key: (apiKey ?? '').trim() || undefined,
        priority,
      }),
    });
    await refreshAll();
  };

  const createProvider = async () => {
    if (!providerForm.name.trim() || !providerForm.base_url.trim() || !providerForm.api_key.trim()) {
      setError('新增 provider 时 name / base_url / api_key 为必填');
      return;
    }
    await fetchJson('/admin/model-providers', {
      method: 'POST',
      body: JSON.stringify({
        name: providerForm.name.trim(),
        base_url: providerForm.base_url.trim(),
        api_key: providerForm.api_key.trim(),
        model_type: providerForm.model_type.trim(),
        priority: providerForm.priority,
        status: providerForm.status,
      }),
    });
    setProviderForm({
      name: '',
      base_url: '',
      api_key: '',
      model_type: 'gpt-image-1',
      priority: 100,
      status: 'active',
    });
    await refreshAll();
  };

  const patchUserFlags = async (
    userId: number,
    patch: { show_new_feature?: boolean; enable_new_model?: boolean },
  ) => {
    await fetchJson(`/admin/users/${userId}/feature-flags`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    await refreshAll();
  };

  return (
    <main style={{ padding: 20, display: 'grid', gap: 16 }}>
      <h1>管理后台</h1>

      <section style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <label htmlFor="token">管理员 JWT 令牌</label>
          <textarea
            id="token"
            rows={3}
            value={token}
            onChange={(e) => setToken(e.target.value.trim())}
            placeholder="粘贴管理员 JWT"
          />
          <label htmlFor="taskLimit">任务数量上限</label>
          <input
            id="taskLimit"
            type="number"
            min={1}
            max={500}
            value={taskLimit}
            onChange={(e) => setTaskLimit(Number(e.target.value) || 100)}
          />
          <label htmlFor="logsLimit">日志数量上限</label>
          <input
            id="logsLimit"
            type="number"
            min={1}
            max={500}
            value={logsLimit}
            onChange={(e) => setLogsLimit(Number(e.target.value) || 50)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => void refreshAll()} disabled={loading || !token}>
              {loading ? '加载中...' : '刷新总览'}
            </button>
            <button onClick={() => void refreshLogs()} disabled={loading || !token}>
              刷新日志
            </button>
            <button onClick={logout}>
              退出登录
            </button>
          </div>
          {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
        </div>
      </section>

      <section style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
        <h2>功能模块</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/admin" onClick={() => setPanel('stats')} className="admin-nav-link">统计概览</Link>
          <Link href="/admin/users" onClick={() => setPanel('users')} className="admin-nav-link">用户管理</Link>
          <Link href="/admin/tasks" onClick={() => setPanel('tasks')} className="admin-nav-link">任务管理</Link>
          <Link href="/admin/providers" onClick={() => setPanel('providers')} className="admin-nav-link">模型提供商</Link>
          <Link href="/admin/logs" onClick={() => setPanel('logs')} className="admin-nav-link">日志管理</Link>
        </div>
      </section>

      {panel === 'stats' ? (
        <section style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
          <h2>统计概览</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(stats, null, 2)}</pre>
        </section>
      ) : null}

      {panel === 'users' ? (
        <section style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
          <h2>用户管理</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="按邮箱搜索"
            value={userKeyword}
            onChange={(e) => setUserKeyword(e.target.value)}
          />
          <select value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value as 'all' | UserRole)}>
            <option value="all">全部角色</option>
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
            <option value="operator">运营</option>
          </select>
          <select value={userStatusFilter} onChange={(e) => setUserStatusFilter(e.target.value as 'all' | UserStatus)}>
            <option value="all">全部状态</option>
            <option value="active">启用</option>
            <option value="disabled">禁用</option>
            <option value="banned">封禁</option>
          </select>
          <input
            type="number"
            min={1}
            max={100}
            value={userPageSize}
            onChange={(e) => setUserPageSize(Number(e.target.value) || 20)}
          />
          <button onClick={() => { setUserPage(1); void refreshAll(); }}>应用筛选</button>
          <button
            onClick={() => {
              setUserPage((prev) => Math.max(1, prev - 1));
            }}
          >
            上一页
          </button>
          <span>第 {userPage} 页</span>
          <button
            onClick={() => {
              setUserPage((prev) => prev + 1);
            }}
          >
            下一页
          </button>
          <button onClick={() => void refreshAll()}>刷新当前页</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>邮箱</th>
                <th>角色</th>
                <th>状态</th>
                <th>积分</th>
                <th>功能开关</th>
                <th>操作</th>
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
                      切换管理员
                    </button>{' '}
                    <button
                      onClick={() =>
                        void patchUserStatus(
                          user.id,
                          user.status === 'active' ? 'disabled' : 'active',
                        )
                      }
                    >
                      启用/禁用
                    </button>{' '}
                    <button onClick={() => void adjustCredits(user.id, 10)}>+10</button>{' '}
                    <button onClick={() => void adjustCredits(user.id, -10)}>-10</button>{' '}
                    <button
                      onClick={() =>
                        void patchUserFlags(user.id, {
                          show_new_feature: !Boolean(user.feature_flags?.show_new_feature),
                        })
                      }
                    >
                      切换新功能
                    </button>{' '}
                    <button
                      onClick={() =>
                        void patchUserFlags(user.id, {
                          enable_new_model: !Boolean(user.feature_flags?.enable_new_model),
                        })
                      }
                    >
                      切换新模型
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </section>
      ) : null}

      {panel === 'tasks' ? (
        <section style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
          <h2>任务管理</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>用户ID</th>
                <th>模式</th>
                <th>状态</th>
                <th>进度</th>
                <th>更新时间</th>
                <th>操作</th>
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
                      取消任务
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </section>
      ) : null}

      {panel === 'providers' ? (
        <section style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
          <h2>模型提供商管理</h2>
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <h3>新增提供商</h3>
          <input
            placeholder="名称"
            value={providerForm.name}
            onChange={(e) => setProviderForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            placeholder="接口地址（base_url）"
            value={providerForm.base_url}
            onChange={(e) => setProviderForm((prev) => ({ ...prev, base_url: e.target.value }))}
          />
          <input
            placeholder="API Key"
            value={providerForm.api_key}
            onChange={(e) => setProviderForm((prev) => ({ ...prev, api_key: e.target.value }))}
          />
          <input
            placeholder="模型类型（model_type）"
            value={providerForm.model_type}
            onChange={(e) => setProviderForm((prev) => ({ ...prev, model_type: e.target.value }))}
          />
          <input
            type="number"
            placeholder="优先级"
            value={providerForm.priority}
            onChange={(e) => setProviderForm((prev) => ({ ...prev, priority: Number(e.target.value) || 100 }))}
          />
          <select
            value={providerForm.status}
            onChange={(e) =>
              setProviderForm((prev) => ({
                ...prev,
                status: e.target.value as ProviderStatus,
              }))
            }
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="error">error</option>
          </select>
          <button onClick={() => void createProvider()}>创建提供商</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>名称</th>
                <th>接口地址</th>
                <th>模型</th>
                <th>状态</th>
                <th>优先级</th>
                <th>操作</th>
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
                    <button onClick={() => void toggleProviderStatus(provider)}>切换状态</button>{' '}
                    <button onClick={() => void saveProvider(provider)}>编辑地址/密钥/优先级</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </section>
      ) : null}

      {panel === 'logs' ? (
        <section style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8, display: 'grid', gap: 12 }}>
          <h2>日志管理</h2>
          <div>
            <h3>请求日志</h3>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(requestLogs, null, 2)}</pre>
          </div>
          <div>
            <h3>错误日志</h3>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(errorLogs, null, 2)}</pre>
          </div>
          <div>
            <h3>模型调用日志</h3>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(apiCallLogs, null, 2)}</pre>
          </div>
        </section>
      ) : null}
    </main>
  );
}
