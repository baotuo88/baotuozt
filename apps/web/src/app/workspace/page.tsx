'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

type Mode = 'ecommerce' | 'social' | 'portrait' | 'general';

interface UserFeatureFlags {
  show_new_feature: boolean;
  enable_new_model: boolean;
}

interface CurrentUser {
  id: number;
  email: string;
  credits: number;
  role: 'user' | 'admin' | 'operator';
  status: 'active' | 'disabled' | 'banned';
  feature_flags?: Partial<UserFeatureFlags>;
}

interface StyleOption {
  id: number;
  name: string;
  mode: Mode;
  version: number;
}

const DEFAULT_STYLES: StyleOption[] = [
  { id: 1, name: '简约商业', mode: 'ecommerce', version: 1 },
  { id: 2, name: '轻奢质感', mode: 'ecommerce', version: 1 },
  { id: 3, name: '活力社交', mode: 'social', version: 1 },
  { id: 4, name: '真实写真', mode: 'portrait', version: 1 },
  { id: 5, name: '创意插画', mode: 'general', version: 1 },
];
const LATEST_TASK_ID_KEY = 'latest_task_id';

export default function WorkspacePage() {
  const [mode, setMode] = useState<Mode>('ecommerce');
  const [styleOptions, setStyleOptions] = useState<StyleOption[]>(DEFAULT_STYLES);
  const [styleId, setStyleId] = useState<number>(DEFAULT_STYLES[0].id);
  const [desc, setDesc] = useState('');
  const [points, setPoints] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [remoteImageUrl, setRemoteImageUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [resultUrl, setResultUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [featureFlags, setFeatureFlags] = useState<UserFeatureFlags>({
    show_new_feature: false,
    enable_new_model: false,
  });
  const [userEmail, setUserEmail] = useState('');
  const [taskStatusText, setTaskStatusText] = useState('');
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  async function pollTaskUntilFinish(input: {
    apiBase: string;
    authToken: string;
    taskId: number;
    onProgress: (progress: number, statusText: string) => void;
    onDone: (resultUrl: string) => void;
    onFailed: (message: string) => void;
  }): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < 3 * 60 * 1000) {
      const taskResp = await fetch(`${input.apiBase}/task/${input.taskId}`, {
        headers: {
          Authorization: `Bearer ${input.authToken}`,
        },
      });
      if (!taskResp.ok) {
        throw new Error('POLL_TASK_FAILED');
      }

      const task = (await taskResp.json()) as {
        status: 'pending' | 'processing' | 'done' | 'failed' | 'canceled';
        progress?: number;
        result_url?: string | null;
      };

      const progress = task.progress ?? 0;
      const statusText =
        task.status === 'pending'
          ? '排队中'
          : task.status === 'processing'
            ? '处理中'
            : task.status === 'done'
              ? '已完成'
              : task.status === 'failed'
                ? '任务失败'
                : '任务已取消';
      input.onProgress(progress, statusText);

      if (task.status === 'done' && task.result_url) {
        input.onDone(task.result_url);
        localStorage.removeItem(LATEST_TASK_ID_KEY);
        return;
      }
      if (task.status === 'failed' || task.status === 'canceled') {
        input.onFailed(task.status === 'failed' ? '任务执行失败，请重试。' : '任务已取消。');
        localStorage.removeItem(LATEST_TASK_ID_KEY);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    throw new Error('POLL_TASK_TIMEOUT');
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setAuthToken(localStorage.getItem('token') || '');
  }, []);

  useEffect(() => {
    if (!apiBase || !authToken) {
      return;
    }
    const latestTaskId = Number(localStorage.getItem(LATEST_TASK_ID_KEY) || '0');
    if (!Number.isInteger(latestTaskId) || latestTaskId <= 0) {
      return;
    }

    setLoading(true);
    setTaskStatusText('恢复最近任务状态中...');
    void pollTaskUntilFinish({
      apiBase,
      authToken,
      taskId: latestTaskId,
      onProgress: (p, statusText) => {
        setProgress(p);
        setTaskStatusText(statusText);
      },
      onDone: (url) => {
        setResultUrl(url);
        setProgress(100);
        setTaskStatusText('生成完成');
        setLoading(false);
      },
      onFailed: (msg) => {
        setErrorMessage(msg);
        setLoading(false);
      },
    }).catch(() => {
      setTaskStatusText('状态恢复失败');
      setLoading(false);
    });
  }, [apiBase, authToken]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!apiBase) {
      return;
    }
    let canceled = false;

    const run = async () => {
      try {
        const response = await fetch(`${apiBase}/styles?mode=${mode}`);
        if (!response.ok) {
          return;
        }
        const rows = (await response.json()) as StyleOption[];
        const valid = rows.filter(
          (item) =>
            Number.isInteger(item.id) &&
            item.id > 0 &&
            typeof item.name === 'string' &&
            (item.mode === 'ecommerce' ||
              item.mode === 'social' ||
              item.mode === 'portrait' ||
              item.mode === 'general'),
        );
        if (valid.length === 0) {
          return;
        }
        if (!canceled) {
          setStyleOptions(valid);
          setStyleId(valid[0].id);
        }
      } catch (_error) {
        // ignore style list fetch failures
      }
    };

    void run();
    return () => {
      canceled = true;
    };
  }, [apiBase, mode]);

  useEffect(() => {
    let canceled = false;
    if (!apiBase || !authToken) {
      return;
    }

    const run = async () => {
      try {
        const headers = {
          Authorization: `Bearer ${authToken}`,
        };

        let resp = await fetch(`${apiBase}/me`, { headers });
        if (!resp.ok) {
          resp = await fetch(`${apiBase}/auth/me`, { headers });
        }
        if (!resp.ok) {
          return;
        }
        const me = (await resp.json()) as CurrentUser;
        if (!canceled) {
          setPoints(Number.isInteger(me.credits) ? me.credits : 0);
          setUserEmail(me.email || '');
          setFeatureFlags({
            show_new_feature: Boolean(me.feature_flags?.show_new_feature),
            enable_new_model: Boolean(me.feature_flags?.enable_new_model),
          });
        }
      } catch (_error) {
        // ignore user profile request failure
      }
    };

    void run();
    return () => {
      canceled = true;
    };
  }, [apiBase, authToken]);

  const trackEvent = async (event: {
    event_type: 'click_generate' | 'select_style' | 'download_image' | 'dwell_time';
    event_value?: string;
    duration_ms?: number;
    metadata?: Record<string, unknown>;
  }) => {
    if (!apiBase || !authToken) {
      return;
    }

    try {
      await fetch(`${apiBase}/events/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(event),
      });
    } catch (_error) {
      // ignore track failure
    }
  };

  const modeLabel = useMemo(() => {
    const map: Record<Mode, string> = {
      ecommerce: '电商',
      social: '社交',
      portrait: '写真',
      general: '通用',
    };
    return map[mode];
  }, [mode]);

  const onUpload = (file?: File) => {
    if (!file) return;
    setErrorMessage('');
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  function normalizeRemoteImageUrl(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
  }

  async function uploadLocalImage(file: File): Promise<string> {
    if (!apiBase) {
      throw new Error('API_BASE_URL_NOT_SET');
    }
    if (!authToken) {
      throw new Error('UNAUTHORIZED');
    }

    const contentType = file.type || 'image/jpeg';
    const buffer = await file.arrayBuffer();
    const resp = await fetch(`${apiBase}/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-upload-file-name': encodeURIComponent(file.name),
        'x-upload-mime-type': contentType,
        Authorization: `Bearer ${authToken}`,
      },
      body: buffer,
    });

    if (!resp.ok) {
      throw new Error('UPLOAD_IMAGE_FAILED');
    }

    const data = (await resp.json()) as { image_url?: string };
    if (!data.image_url) {
      throw new Error('UPLOAD_IMAGE_URL_MISSING');
    }
    return data.image_url;
  }

  const selectedStyle = useMemo(
    () => styleOptions.find((item) => item.id === styleId) ?? null,
    [styleId, styleOptions],
  );

  const onGenerate = async () => {
    setErrorMessage('');

    if (!authToken) {
      setErrorMessage('请先登录后再生成图片（右上角“账号”）。');
      return;
    }

    setLoading(true);
    setProgress(10);
    setTaskStatusText('准备任务...');
    setResultUrl('');

    let normalizedRemoteUrl = normalizeRemoteImageUrl(remoteImageUrl);

    if (!normalizedRemoteUrl && selectedFile) {
      try {
        normalizedRemoteUrl = await uploadLocalImage(selectedFile);
        setRemoteImageUrl(normalizedRemoteUrl);
      } catch (_error) {
        setErrorMessage('图片上传失败，请稍后重试。');
        setLoading(false);
        return;
      }
    }

    if (remoteImageUrl && !normalizedRemoteUrl) {
      setErrorMessage('图片URL格式错误，请输入 http/https 地址。');
      setLoading(false);
      return;
    }

    await trackEvent({
      event_type: 'click_generate',
      metadata: { mode, style_id: styleId, style_name: selectedStyle?.name ?? '' },
    });

    try {
      const createResp = await fetch(`${apiBase}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          mode,
          style_id: styleId,
          image_url: normalizedRemoteUrl,
          user_input: desc || null,
        }),
      });

      if (!createResp.ok) {
        throw new Error('CREATE_TASK_FAILED');
      }

      const created = (await createResp.json()) as { task_id: number | null; result_url?: string; from_cache: boolean };

      if (created.from_cache && created.result_url) {
        setProgress(100);
        setTaskStatusText('命中缓存，已直接返回结果');
        setResultUrl(created.result_url);
        setLoading(false);
        return;
      }

      if (!created.task_id) {
        throw new Error('TASK_ID_MISSING');
      }
      localStorage.setItem(LATEST_TASK_ID_KEY, String(created.task_id));

      await pollTaskUntilFinish({
        apiBase,
        authToken,
        taskId: created.task_id,
        onProgress: (p, statusText) => {
          setProgress(p);
          setTaskStatusText(statusText);
        },
        onDone: (url) => {
          setResultUrl(url);
          setProgress(100);
          setTaskStatusText('生成完成');
        },
        onFailed: (msg) => {
          setErrorMessage(msg);
        },
      });
      setLoading(false);
    } catch (_error) {
      setErrorMessage('创建任务失败，请稍后重试。');
      setTaskStatusText('创建失败');
      setLoading(false);
    }
  };

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="brand">宝拓智图 · 工作台</p>
          <h1>{modeLabel}出图</h1>
          {userEmail ? <p className="brand">当前账号：{userEmail}</p> : null}
          {featureFlags.enable_new_model ? <p className="brand">已启用：新模型通道</p> : null}
        </div>
        <div className="points">点数：{points}</div>
      </header>

      <section className="panel">
        <div className="left">
          <label>
            模式
            <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="ecommerce">电商</option>
              <option value="social">社交</option>
              <option value="portrait">写真</option>
              <option value="general">通用</option>
            </select>
          </label>

          <label>
            上传图片
            <input type="file" accept="image/*" onChange={(e) => onUpload(e.target.files?.[0])} />
          </label>

          <label>
            图片URL（可选）
            <input
              placeholder="https://example.com/your-image.jpg"
              value={remoteImageUrl}
              onChange={(e) => setRemoteImageUrl(e.target.value)}
            />
          </label>

          <label>
            输入描述
            <textarea
              placeholder="输入你想生成的内容描述"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </label>

          <label>
            选择风格
            <select
              value={String(styleId)}
              onChange={(e) => {
                const nextStyleId = Number(e.target.value);
                if (!Number.isInteger(nextStyleId) || nextStyleId <= 0) {
                  return;
                }
                setStyleId(nextStyleId);
                const style = styleOptions.find((item) => item.id === nextStyleId);
                void trackEvent({
                  event_type: 'select_style',
                  event_value: style ? style.name : String(nextStyleId),
                  metadata: { mode, style_id: nextStyleId },
                });
              }}
            >
              {styleOptions.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          {featureFlags.show_new_feature ? (
            <label>
              新功能实验区
              <input value="你已加入灰度发布名单" readOnly />
            </label>
          ) : null}

          <button onClick={onGenerate} disabled={loading}>
            {loading ? '生成中...' : '生成'}
          </button>
          {errorMessage ? <p style={{ color: '#b42318', margin: 0 }}>{errorMessage}</p> : null}
          <div>
            任务进度：{progress}% {taskStatusText ? `· ${taskStatusText}` : ''}
            <div style={{ height: 8, background: '#eadfcf', borderRadius: 999, marginTop: 6 }}>
              <div
                style={{
                  width: `${Math.max(0, Math.min(progress, 100))}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #d47c3c, #e7a255)',
                  borderRadius: 999,
                  transition: 'width .25s ease',
                }}
              />
            </div>
          </div>
        </div>

        <div className="right">
          <h2>生成结果</h2>
          <div className="result-box">
            {resultUrl ? (
              <Image
                src={resultUrl}
                alt="生成结果"
                width={1080}
                height={1080}
                sizes="(max-width: 900px) 100vw, 50vw"
              />
            ) : (
              <p>生成后在这里显示图片</p>
            )}
          </div>
          {resultUrl ? (
            <a className="download" href={resultUrl} download>
              下载图片
            </a>
          ) : null}
        </div>
      </section>
    </main>
  );
}
