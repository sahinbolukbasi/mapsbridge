import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "export" kaldırıldı — Lambda SSR moduna geçildi (middleware + server-side auth)
  trailingSlash: true,
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
