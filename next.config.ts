import type { NextConfig } from "next";
import withPWA from 'next-pwa';
import withBundleAnalyzer from '@next/bundle-analyzer';

const nextConfig: NextConfig = {
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  
  // Production optimizations
  productionBrowserSourceMaps: true, // Enable source maps for debugging
  
  // Bundle optimization
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', '@supabase/supabase-js', 'react-markdown', '@tiptap/react'],
    optimizeCss: true,
    // Merge CSS chunks to reduce preloads and "preloaded but not used" warnings (see next.js#51524)
    cssChunking: true,
    webVitalsAttribution: ['CLS', 'LCP', 'FCP', 'FID', 'TTFB'],
    scrollRestoration: true,
    // Enable modern JavaScript output for smaller bundles
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Turbopack configuration (empty to silence warnings)
  turbopack: {},
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // Keep error and warn logs
    } : false,
    // Enable React compiler optimizations
    reactRemoveProperties: process.env.NODE_ENV === 'production' ? { properties: ['^data-test'] } : false,
  },
  
  // Bundle analyzer and optimization
  webpack: (config, { dev, isServer }) => {
    // Only optimize in production
    if (!dev && !isServer) {
      // Configure hidden source maps for production (loaded only when DevTools is open)
      config.devtool = 'hidden-source-map'
      
      // Minimize bundle size
      config.optimization.usedExports = true
      config.optimization.sideEffects = false
      
      // Split vendor bundles for better caching
      config.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: 25,
        minSize: 20000,
        cacheGroups: {
          // React and React-DOM in separate chunk
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            name: 'react-vendor',
            priority: 40,
            reuseExistingChunk: true,
          },
          // Chart libraries in separate chunk
          charts: {
            test: /[\\/]node_modules[\\/](recharts|d3-.*)[\\/]/,
            name: 'charts-vendor',
            priority: 35,
            reuseExistingChunk: true,
          },
          // Rich text editor in separate chunk (TipTap)
          editor: {
            test: /[\\/]node_modules[\\/](@tiptap|prosemirror-.*)[\\/]/,
            name: 'editor-vendor',
            priority: 35,
            reuseExistingChunk: true,
          },
          // Supabase in separate chunk
          supabase: {
            test: /[\\/]node_modules[\\/](@supabase)[\\/]/,
            name: 'supabase-vendor',
            priority: 30,
            reuseExistingChunk: true,
          },
          // Lucide icons in separate chunk
          icons: {
            test: /[\\/]node_modules[\\/](lucide-react)[\\/]/,
            name: 'icons-vendor',
            priority: 25,
            reuseExistingChunk: true,
          },
          // Markdown rendering libraries
          markdown: {
            test: /[\\/]node_modules[\\/](react-markdown|remark-.*|rehype-.*|unified|micromark.*|mdast.*|hast.*|unist.*)[\\/]/,
            name: 'markdown-vendor',
            priority: 25,
            reuseExistingChunk: true,
          },
          // Date picker library
          datepicker: {
            test: /[\\/]node_modules[\\/](react-datepicker|date-fns)[\\/]/,
            name: 'datepicker-vendor',
            priority: 20,
            reuseExistingChunk: true,
          },
          // Other vendor libraries
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            priority: 10,
            reuseExistingChunk: true,
            minChunks: 2,
          },
          // Common code shared across pages
          common: {
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
            minSize: 10000,
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

  // Redirect root to /login (workaround for Next.js 16 root route 404 with Turbopack/webpack)
  async redirects() {
    return [
      { source: '/', destination: '/login', permanent: false },
    ];
  },

  // Security headers (SECURITY_CHECKLIST)
  async headers() {
    const isProd = process.env.NODE_ENV === 'production'
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]
    if (isProd) {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      })
      securityHeaders.push({
        key: 'Content-Security-Policy-Report-Only',
        value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.sentry.io https://*.supabase.co https://*.onrender.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      })
    }
    return [{ source: '/:path*', headers: securityHeaders }]
  },

  // Redirects for API calls
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'https://orka-ppm.onrender.com';
    // Don't rewrite if backend URL is /api (circular)
    if (backendUrl === '/api') {
      return [
        // Exclude optimized dashboard routes from rewrite - let Next.js handle them
        {
          source: '/api/optimized/:path*',
          destination: '/api/optimized/:path*',
        },
        // Monte Carlo and other /api/v1 routes: backend expects /api/v1/... (prefix in FastAPI)
        {
          source: '/api/v1/:path*',
          destination: `http://localhost:8000/api/v1/:path*`,
        },
        // Audit: backend expects /api/audit (FastAPI router prefix)
        {
          source: '/api/audit/:path*',
          destination: `http://localhost:8000/api/audit/:path*`,
        },
      // Rewrite all other /api calls to local backend (no /api prefix on backend)
        {
          source: '/api/:path*',
          destination: `http://localhost:8000/:path*`,
        },
      ];
    }
    return [
      // Exclude optimized dashboard routes from rewrite - let Next.js handle them
      {
        source: '/api/optimized/:path*',
        destination: '/api/optimized/:path*',
      },
      // Monte Carlo and other /api/v1 routes: backend expects /api/v1/... (prefix in FastAPI)
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
      // Audit router uses prefix /api/audit – preserve full path so backend receives /api/audit/logs etc.
      {
        source: '/api/audit/:path*',
        destination: `${backendUrl}/api/audit/:path*`,
      },
      // Rewrite all other /api calls to backend (no /api prefix on backend)
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
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

const configWithPwa = withAnalyzer(pwaConfig(nextConfig as any));

// Sentry is optional (e.g. when not installed for test runs)
let finalConfig: NextConfig = configWithPwa;
try {
  const { withSentryConfig } = require('@sentry/nextjs');
  finalConfig = withSentryConfig(configWithPwa, {
    silent: !process.env.CI,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  });
} catch {
  // @sentry/nextjs not installed
}

export default finalConfig;
