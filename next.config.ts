import type { NextConfig } from "next";
import withPWA from 'next-pwa';
import withBundleAnalyzer from '@next/bundle-analyzer';

const nextConfig: NextConfig = {
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  
  // Production optimizations
  productionBrowserSourceMaps: false,
  
  // Bundle optimization
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', '@supabase/supabase-js'],
    optimizeCss: true,
    webVitalsAttribution: ['CLS', 'LCP', 'FCP', 'FID', 'TTFB'],
    scrollRestoration: true,
  },
  
  // Turbopack configuration (empty to silence warnings)
  turbopack: {},
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // Keep error and warn logs
    } : false,
    styledComponents: false, // Disable if not using styled-components
  },
  
  // Bundle analyzer and optimization
  webpack: (config, { dev, isServer }) => {
    // Only optimize in production
    if (!dev && !isServer) {
      // Minimize bundle size
      config.optimization.usedExports = true
      config.optimization.sideEffects = false
      
      // Split vendor bundles for better caching
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          // React and React-DOM in separate chunk
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react-vendor',
            priority: 40,
            reuseExistingChunk: true,
          },
          // Chart libraries in separate chunk
          charts: {
            test: /[\\/]node_modules[\\/](recharts|d3-.*)[\\/]/,
            name: 'charts-vendor',
            priority: 30,
            reuseExistingChunk: true,
          },
          // Rich text editor in separate chunk
          editor: {
            test: /[\\/]node_modules[\\/](@tiptap)[\\/]/,
            name: 'editor-vendor',
            priority: 30,
            reuseExistingChunk: true,
          },
          // Supabase in separate chunk
          supabase: {
            test: /[\\/]node_modules[\\/](@supabase)[\\/]/,
            name: 'supabase-vendor',
            priority: 25,
            reuseExistingChunk: true,
          },
          // Lucide icons in separate chunk
          icons: {
            test: /[\\/]node_modules[\\/](lucide-react)[\\/]/,
            name: 'icons-vendor',
            priority: 20,
            reuseExistingChunk: true,
          },
          // Other vendor libraries
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            priority: 10,
            reuseExistingChunk: true,
          },
          // Common code shared across pages
          common: {
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      }
    }
    
    return config
  },
  
  // Environment variables validation
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: true, // Skip type checking in production build
    tsconfigPath: './tsconfig.prod.json',
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xceyrfvxooiplbmwavlb.supabase.co',
        port: '',
        pathname: '/**',
      },
    ],
    unoptimized: false,
  },

  // Redirects for API calls
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://orka-ppm.onrender.com'}/:path*`,
      },
    ];
  },
};

// PWA Configuration with Workbox runtime caching
const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // Workbox runtime caching configuration
  runtimeCaching: [
    // API caching with 5-minute expiration
    {
      urlPattern: /^https?:\/\/.*\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
        networkTimeoutSeconds: 10,
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    // Dashboard data caching
    {
      urlPattern: /^https?:\/\/.*\/api\/(dashboards|projects|resources|risks)\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'dashboard-data-cache',
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
        networkTimeoutSeconds: 10,
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    // Static assets - Cache-first strategy for instant loading
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    // Fonts - Cache-first strategy
    {
      urlPattern: /\.(?:woff|woff2|ttf|eot|otf)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'font-cache',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    // CSS and JavaScript - Cache-first with network fallback
    {
      urlPattern: /\.(?:css|js)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-resources',
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    // Next.js static assets
    {
      urlPattern: /^\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    // Next.js images
    {
      urlPattern: /^\/_next\/image\?.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-image-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ],
});

// Bundle analyzer configuration
const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withAnalyzer(pwaConfig(nextConfig as any));
