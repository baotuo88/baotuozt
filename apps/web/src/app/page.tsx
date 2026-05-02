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
      <section className="hero">
        <p className="tag">宝拓智图</p>
        <h1>多功能 AI 生图平台</h1>
        <p>选择场景即可创作，无需复杂 Prompt。</p>
      </section>

      <section className="grid">
        {entries.map((item) => (
          <Link key={item.key} href={item.href} className="entry-card">
            <h2>{item.key}</h2>
            <p>{item.desc}</p>
            <span>进入工作台</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
