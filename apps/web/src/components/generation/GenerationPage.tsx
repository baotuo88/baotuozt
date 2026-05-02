'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ProgressBar } from '@/components/ui/ProgressBar';

type Mode = 'ecommerce' | 'social' | 'portrait' | 'general';

interface StyleOption {
  id: number;
  name: string;
  mode: Mode;
  version: number;
}

interface GenerationPageProps {
  mode: Mode;
  title: string;
  description: string;
}

const LATEST_TASK_ID_KEY = 'latest_task_id';

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
      headers: { Authorization: `Bearer ${input.authToken}` },
    });
    if (!taskResp.ok) throw new Error('POLL_TASK_FAILED');

    const task = await taskResp.json() as {
      status: 'pending' | 'processing' | 'done' | 'failed' | 'canceled';
      progress?: number;
      result_url?: string | null;
    };

    const progress = task.progress ?? 0;
    const statusText = task.status === 'pending' ? '排队中' : task.status === 'processing' ? '处理中' : task.status === 'done' ? '已完成' : task.status === 'failed' ? '任务失败' : '任务已取消';
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

export function GenerationPage({ mode, title, description }: GenerationPageProps) {
  const [styleOptions, setStyleOptions] = useState<StyleOption[]>([]);
  const [styleId, setStyleId] = useState<number>(0);
  const [desc, setDesc] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [remoteImageUrl, setRemoteImageUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [resultUrl, setResultUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [taskStatusText, setTaskStatusText] = useState('');
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAuthToken(localStorage.getItem('token') || '');
    }
  }, []);

  useEffect(() => {
    if (!apiBase) return;

    fetch(`${apiBase}/styles?mode=${mode}`)
      .then(res => res.json())
      .then((rows: StyleOption[]) => {
        const valid = rows.filter(item => item.id > 0 && item.mode === mode);
        if (valid.length > 0) {
          setStyleOptions(valid);
          setStyleId(valid[0].id);
        }
      })
      .catch(() => {});
  }, [apiBase, mode]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onUpload = (file?: File) => {
    if (!file) return;
    setErrorMessage('');
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  async function uploadLocalImage(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const resp = await fetch(`${apiBase}/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-upload-file-name': encodeURIComponent(file.name),
        'x-upload-mime-type': file.type || 'image/jpeg',
        Authorization: `Bearer ${authToken}`,
      },
      body: buffer,
    });

    if (!resp.ok) throw new Error('UPLOAD_IMAGE_FAILED');
    const data = await resp.json() as { image_url?: string };
    if (!data.image_url) throw new Error('UPLOAD_IMAGE_URL_MISSING');
    return data.image_url;
  }

  const onGenerate = async () => {
    setErrorMessage('');
    if (!authToken) {
      setErrorMessage('请先登录后再生成图片。');
      return;
    }

    if (!styleId || styleId === 0) {
      setErrorMessage('请选择一个风格后再生成。');
      return;
    }

    setLoading(true);
    setProgress(10);
    setTaskStatusText('准备任务...');
    setResultUrl('');

    let normalizedRemoteUrl = remoteImageUrl.trim() && /^https?:\/\//i.test(remoteImageUrl.trim()) ? remoteImageUrl.trim() : null;

    if (!normalizedRemoteUrl && selectedFile) {
      try {
        normalizedRemoteUrl = await uploadLocalImage(selectedFile);
        setRemoteImageUrl(normalizedRemoteUrl);
      } catch (error) {
        console.error('Upload error:', error);
        setErrorMessage('图片上传失败，请稍后重试。');
        setLoading(false);
        setProgress(0);
        return;
      }
    }

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
        const errorData = await createResp.json().catch(() => ({}));
        const errorMsg = errorData.message || `请求失败 (${createResp.status})`;
        throw new Error(errorMsg);
      }

      const created = await createResp.json() as { task_id: number | null; result_url?: string; from_cache: boolean };

      if (created.from_cache && created.result_url) {
        setProgress(100);
        setTaskStatusText('命中缓存，已直接返回结果');
        setResultUrl(created.result_url);
        setLoading(false);
        return;
      }

      if (!created.task_id) throw new Error('TASK_ID_MISSING');
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
    } catch (error) {
      console.error('Generation error:', error);
      const errorMsg = error instanceof Error ? error.message : '创建任务失败，请稍后重试。';
      setErrorMessage(errorMsg);
      setTaskStatusText('创建失败');
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">{title}</h1>
            <p className="text-[#a3a3a3]">{description}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <div className="space-y-4">
                <Input
                  label="上传图片"
                  type="file"
                  accept="image/*"
                  onChange={(e) => onUpload(e.target.files?.[0])}
                />

                {previewUrl && (
                  <div className="aspect-square bg-[#141414] rounded-xl overflow-hidden">
                    <img src={previewUrl} alt="预览" className="w-full h-full object-cover" />
                  </div>
                )}

                <Input
                  label="图片URL（可选）"
                  placeholder="https://example.com/your-image.jpg"
                  value={remoteImageUrl}
                  onChange={(e) => setRemoteImageUrl(e.target.value)}
                />

                <Textarea
                  label="输入描述"
                  placeholder="输入你想生成的内容描述"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />

                <Select
                  label="选择风格"
                  value={String(styleId)}
                  onChange={(e) => setStyleId(Number(e.target.value))}
                >
                  {styleOptions.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </Select>

                <Button onClick={onGenerate} disabled={loading} className="w-full">
                  {loading ? '生成中...' : '开始生成'}
                </Button>

                {errorMessage && (
                  <div className="p-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl text-[#ef4444] text-sm">
                    {errorMessage}
                  </div>
                )}

                {(loading || progress > 0) && (
                  <ProgressBar progress={progress} label={taskStatusText} />
                )}
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-bold mb-4 text-[#a3a3a3]">生成结果</h2>
              <div className="aspect-square bg-[#141414] border-2 border-dashed border-[#2a2a2a] rounded-xl flex items-center justify-center overflow-hidden">
                {resultUrl ? (
                  <Image src={resultUrl} alt="生成结果" width={1080} height={1080} className="w-full h-full object-cover" />
                ) : (
                  <p className="text-[#a3a3a3]">生成后在这里显示图片</p>
                )}
              </div>
              {resultUrl && (
                <a href={resultUrl} download className="mt-4 inline-block px-6 py-3 bg-[#06b6d4] text-white rounded-xl font-semibold hover:bg-[#0891b2] transition-colors">
                  下载图片
                </a>
              )}
            </Card>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
