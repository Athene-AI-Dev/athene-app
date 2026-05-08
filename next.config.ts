import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"], // Optimize image formats
    dangerouslyAllowSVG: true,
  },
};


export default nextConfig;
