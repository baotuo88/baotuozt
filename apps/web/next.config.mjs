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
};

export default nextConfig;
