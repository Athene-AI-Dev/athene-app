import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disable strict mode for production performance
  images: {
    formats: ["image/avif", "image/webp"], // Optimize image formats
    dangerouslyAllowSVG: true,
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=3600, s-maxage=3600",
        },
      ],
    },
  ],
};

export default nextConfig;
