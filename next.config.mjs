/** @type {import('next').NextConfig} */
const nextConfig = {
  // ffmpeg.wasm and transformers.js both need these headers so the browser
  // allows SharedArrayBuffer / threaded WASM.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
