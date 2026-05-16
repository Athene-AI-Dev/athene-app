import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"], // Optimize image formats
    dangerouslyAllowSVG: true,
  },
  // Allow @xenova/transformers to run in the Node.js server runtime
  // without being bundled by webpack (it uses dynamic requires + FS access)
  serverExternalPackages: ["@xenova/transformers"],
  webpack: (config) => {
    // Prevent webpack from trying to bundle ONNX .wasm files
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};


export default nextConfig;
