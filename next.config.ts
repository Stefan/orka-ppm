import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo configuration - trace files from project root
  outputFileTracingRoot: process.cwd(),
  
  // Environment variables validation
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  // TypeScript - ignore build errors for deployment
  typescript: {
    ignoreBuildErrors: false,
  },

  // Image optimization
  images: {
    domains: [],
    unoptimized: true,
  },

  // Turbopack configuration for Next.js 16
  turbopack: {},
};

export default nextConfig;
