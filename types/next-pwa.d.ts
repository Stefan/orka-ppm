// Type definitions for next-pwa
declare module 'next-pwa' {
  import { NextConfig } from 'next'
  
  interface PWAConfig {
    dest?: string
    disable?: boolean
    register?: boolean
    skipWaiting?: boolean
    sw?: string
    runtimeCaching?: any[]
    buildExcludes?: (string | RegExp)[]
    publicExcludes?: string[]
    cacheOnFrontEndNav?: boolean
    subdomainPrefix?: string
    reloadOnOnline?: boolean
    fallbacks?: {
      document?: string
      image?: string
      audio?: string
      video?: string
      font?: string
    }
  }

  function withPWA(config: PWAConfig): (nextConfig?: NextConfig) => NextConfig
  export = withPWA
}