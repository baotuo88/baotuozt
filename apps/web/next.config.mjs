/** @type {import('next').NextConfig} */
function parseRemoteImageHostnames() {
  const fromEnv = process.env.NEXT_PUBLIC_IMAGE_HOSTS || '';
  return fromEnv
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const imageHostnames = parseRemoteImageHostnames();

const nextConfig = {
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      ...imageHostnames.map((hostname) => ({
        protocol: 'https',
        hostname,
      })),
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://api:3000/:path*',
      },
      {
        source: '/healthz',
        destination: 'http://api:3000/healthz',
      },
      {
        source: '/readyz',
        destination: 'http://api:3000/readyz',
      },
      {
        source: '/uploaded/:path*',
        destination: 'http://api:3000/uploaded/:path*',
      },
      {
        source: '/image/:path*',
        destination: 'http://api:3000/image/:path*',
      },
    ];
  },
};

export default nextConfig;
