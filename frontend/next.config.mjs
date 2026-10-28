/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true
  },
  env: {
    NEXT_PUBLIC_DEFAULT_DEVICE_ID: 'RS-ESP32S3-01'
  }
};

export default nextConfig;
