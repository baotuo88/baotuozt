import Link from 'next/link';

const entries = [
  { key: '电商', desc: '主图 / 详情 / 场景图', href: '/workspace?mode=ecommerce' },
  { key: '社交', desc: '小红书 / 抖音封面', href: '/workspace?mode=social' },
  { key: '写真', desc: 'AI 人像写真生成', href: '/workspace?mode=portrait' },
  { key: '通用', desc: '自由文生图创作', href: '/workspace?mode=general' },
];

export default function HomePage() {
  return (
    <main className="home">
      <div className="home-topbar">
        <div className="logo">宝拓智图</div>
        <Link href="/auth" className="account-link">登录 / 注册</Link>
      </div>
      <section className="hero">
        <p className="tag">AI 生图平台</p>
        <h1>专业 AI 图像生成</h1>
        <p>多场景智能生图，无需复杂提示词，一键生成专业级作品</p>
      </section>

      <section className="grid">
        {entries.map((item) => (
          <Link key={item.key} href={item.href} className="entry-card">
            <h2>{item.key}</h2>
            <p>{item.desc}</p>
            <span>开始创作</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
