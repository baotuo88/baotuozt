import type { Metadata } from 'next';
import Script from 'next/script';
import Image from 'next/image';
import { notFound } from 'next/navigation';

interface ImageDetail {
  id: number;
  result_url: string;
  prompt: string;
}

async function getImageDetail(id: string): Promise<ImageDetail | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (apiBase) {
    try {
      const response = await fetch(`${apiBase}/image/${id}`, {
        next: { revalidate: 300 },
      });

      if (response.ok) {
        return (await response.json()) as ImageDetail;
      }
    } catch (_error) {
      // fallback to mock data below
    }
  }

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return null;
  }

  return {
    id: numericId,
    result_url: `https://picsum.photos/seed/baotuo-${numericId}/1200/1200`,
    prompt: '高质感产品海报，暖色自然光，细节清晰，商业摄影风格',
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getImageDetail(id);

  if (!data) {
    return {
      title: '图片不存在 | 宝拓智图',
      description: '请求的图片不存在或已下线。',
    };
  }

  const title = `AI生成图片 #${data.id} | 宝拓智图`;
  const description = `Prompt：${data.prompt.slice(0, 120)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: data.result_url }],
      type: 'article',
    },
  };
}

export default async function ImageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getImageDetail(id);

  if (!data) {
    notFound();
  }

  return (
    <main className="image-page">
      <article className="image-card">
        <h1>AI生成图片 #{data.id}</h1>

        <div className="image-preview">
          <Image
            src={data.result_url}
            alt={data.prompt}
            width={1200}
            height={1200}
            sizes="(max-width: 900px) 100vw, 900px"
            priority
          />
        </div>

        <section className="prompt-block">
          <h2>Prompt 描述</h2>
          <p>{data.prompt}</p>
        </section>

        <a className="download" href={data.result_url} download>
          下载图片
        </a>
      </article>
      <Script
        id="image-events"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function () {
              const startedAt = Date.now();
              const apiBase = '${process.env.NEXT_PUBLIC_API_BASE_URL || ''}';
              const downloadBtn = document.querySelector('.download');

              function track(payload) {
                if (!apiBase) return;
                const token = window.localStorage ? window.localStorage.getItem('token') : null;
                if (!token) return;
                fetch(apiBase + '/events/track', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                  },
                  body: JSON.stringify(payload)
                }).catch(function(){});
              }

              if (downloadBtn) {
                downloadBtn.addEventListener('click', function () {
                  track({
                    event_type: 'download_image',
                    event_value: '${String(data.id)}',
                    metadata: { image_id: ${data.id} }
                  });
                });
              }

              window.addEventListener('beforeunload', function () {
                const duration = Date.now() - startedAt;
                track({
                  event_type: 'dwell_time',
                  event_value: '${String(data.id)}',
                  duration_ms: duration,
                  metadata: { image_id: ${data.id}, page: 'image_detail' }
                });
              });
            })();
          `,
        }}
      />
    </main>
  );
}
