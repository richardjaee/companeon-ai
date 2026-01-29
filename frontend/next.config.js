/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

// Force load .env.production file in production environment
const path = require('path');
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: path.join(__dirname, '.env.production') });
}

const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 20) {
  }

const isDev = process.env.NODE_ENV !== 'production';
const devSources = isDev ? ' http://localhost:*' : '';

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self' https://companeon.io https://www.companeon.io;
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://companeon.io https://www.companeon.io https://verify.walletconnect.com https://*.walletconnect.com https://*.reown.com https://*.paypal.com https://www.sandbox.paypal.com https://*.web3auth.io https://*.hcaptcha.com https://js.hcaptcha.com;
      worker-src 'self' blob:;
      connect-src 'self' https://companeon.io https://www.companeon.io https://api.basescan.org https://api.0x.org https://api.coingecko.com https://o4509105767972864.ingest.us.sentry.io https://*.sentry.io https://*.ingest.sentry.io https://*.g.alchemy.com wss://*.g.alchemy.com https://*.wallet.coinbase.com wss://*.walletlink.org https://chain-proxy.wallet.coinbase.com https://api.cdp.coinbase.com https://*.coinbase.com https://*.paypal.com https://www.sandbox.paypal.com https://cloudflare-eth.com https://*.us-central1.run.app wss://*.us-central1.run.app https://explorer-api.walletconnect.com https://rpc.walletconnect.com https://api.walletconnect.com https://*.walletconnect.com https://explorer-api.reown.com https://*.reown.com https://pulse.walletconnect.org https://api.web3modal.org wss://relay.walletconnect.org wss://relay.walletconnect.com wss://*.walletconnect.com wss://*.reown.com https://*.web3auth.io wss://*.web3auth.io https://api.web3auth.io https://assets.web3auth.io https://develop-nft-checkout.web3auth.io https://session.web3auth.io wss://session.web3auth.io https://*.hcaptcha.com https://cdn.segment.com https://*.segment.io https://mm-sdk-analytics.api.cx.metamask.io https://*.metamask.io https://rpc.ankr.com;
      img-src 'self' data: blob: https://companeon.io https://www.companeon.io https://nft-cdn.alchemy.com https://i.seadn.io https://ipfs.io https://storage.googleapis.com https://static.alchemyapi.io https://www.paypalobjects.com https://registry.walletconnect.com https://images.walletconnect.com https://*.walletconnect.com https://*.reown.com https://images.web3auth.io https://*.web3auth.io https://web-images.credcdn.in https://web3auth.io https://web3auth.io/images/ https://*.run.app${devSources};
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.paypal.com https://www.sandbox.paypal.com;
      font-src 'self' https://fonts.gstatic.com data:;
      frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org https://www.paypal.com https://*.paypal.com https://www.sandbox.paypal.com https://connect.solflare.com https://*.walletconnect.com https://*.reown.com https://*.web3auth.io https://*.hcaptcha.com;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
    `.replace(/\s{2,}/g, ' ').trim()
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'unsafe-none'
  },
  {
    key: 'Cross-Origin-Embedder-Policy',
    value: 'unsafe-none'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self)'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains'
  }
];

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Enable standalone output for optimized Docker builds
  // Prevent Next.js from inferring the wrong workspace root when multiple lockfiles exist
  outputFileTracingRoot: __dirname,
  experimental: {
    clientTraceMetadata: [],
  },
  // Reduce caching issues during development
  onDemandEntries: {
    // Keep pages in memory for longer
    maxInactiveAge: 15 * 1000,
    // Number of pages to keep in memory
    pagesBufferLength: 2,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'nft-cdn.alchemy.com',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
      },
      {
        protocol: 'https',
        hostname: 'i.seadn.io',
      },
      {
        protocol: 'https',
        hostname: 'static.alchemyapi.io',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      }
    ],
    unoptimized: false,
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400, // 24 hours
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  typescript: {
    ignoreBuildErrors: false
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  env: {
    // Provide env passthroughs only; no project-specific defaults
    NEXT_PUBLIC_COMPANEON_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_COMPANEON_CONTRACT_ADDRESS,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    NEXT_PUBLIC_CDP_PROJECT_ID: process.env.NEXT_PUBLIC_CDP_PROJECT_ID,
  },

  webpack: (config, { isServer }) => {
    // Suppress OpenTelemetry warnings
    const commonIgnore = [
      { module: /@opentelemetry\/instrumentation/ },
      { message: /Critical dependency: the request of a dependency is an expression/ }
    ];
    if (Array.isArray(config.ignoreWarnings)) {
      config.ignoreWarnings.push(...commonIgnore);
    } else {
      config.ignoreWarnings = commonIgnore;
    }
    
    config.resolve.fallback = { 
      fs: false,
      net: false,
      tls: false,
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      url: require.resolve('url'),
      zlib: require.resolve('browserify-zlib'),
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      assert: require.resolve('assert'),
      os: require.resolve('os-browserify'),
      path: require.resolve('path-browserify'),
    };
    
    // Ensure @ alias is resolved properly
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname, 'src'),
      // Ensure Node's deprecated built-in punycode resolves to the maintained package
      punycode: require.resolve('punycode/')
    };
    
    return config;
  },
  async headers() {
    return [
      // Security headers for all routes
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // Don't cache HTML pages - prevent stale chunk references
      {
        source: '/:path((?!_next/static|api|images|favicon\\.ico|sitemap\\.xml|manifest\\.json).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=0, must-revalidate'
          }
        ]
      },
      // Cache Next.js static assets forever (they have unique hashes)
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      // Cache images aggressively
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        source: '/:path*.(png|jpg|jpeg|webp|avif|gif|svg|ico)',
        headers: [
          {
            key: 'Cache-Control', 
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      // Cache videos aggressively
      {
        source: '/animations/:path*.(mp4|webm|mov)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'Accept-Ranges',
            value: 'bytes'
          }
        ]
      }
    ];
  },
  async redirects() {
    return [
      // Force HTTPS redirects for all HTTP requests
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://companeon.io/:path*',
        permanent: true,
      },
      {
        source: '/documentation',
        destination: '/learn',
        permanent: true,
      },
      {
        source: '/how-it-works',
        destination: '/learn/how-it-works',
        permanent: true,
      },
      {
        source: '/security',
        destination: '/learn/security',
        permanent: true,
      },
      {
        source: '/whitepaper',
        destination: '/learn/technical',
        permanent: true,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/manifest.json',
        destination: '/api/manifest'
      }
    ]
  }
};

const shouldUseSentry = process.env.NODE_ENV === 'production' && !process.env.CI && process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true';

if (shouldUseSentry) {
  module.exports = withSentryConfig(
    nextConfig,
    {

      // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

      org: "companeon",
      project: "javascript-nextjs",

      silent: !process.env.CI,

      widenClientFileUpload: false,

      disableLogger: true,

      
      hideSourceMaps: true,
      
      transpileClientSDK: false,
      
      // Disable all automatic instrumentation to prevent string transformations
      autoInstrumentServerFunctions: false,
      autoInstrumentMiddleware: false,
      autoInstrumentAppDirectory: false,
      
      // Allow API routes to be instrumented by Sentry
    }
  );
} else {

  module.exports = nextConfig;
}
