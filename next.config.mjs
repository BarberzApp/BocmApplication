import withPWA from 'next-pwa'
import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'localhost',
      'res.cloudinary.com',
      'lh3.googleusercontent.com',
      'avatars.githubusercontent.com',
      'images.unsplash.com'
    ],
  },
  // Copy service worker to public directory during build
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

// Temporarily disable PWA to fix build issues
const pwaConfig = {
  disable: true,
};

// Sentry configuration
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suppresses source map uploading logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  
  // Only upload source maps in production
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableClientWebpackPlugin: process.env.NODE_ENV !== 'production',
  disableServerWebpackPlugin: process.env.NODE_ENV !== 'production',
};

// Apply Sentry config, then PWA config
const configWithSentry = withSentryConfig(
  nextConfig,
  sentryWebpackPluginOptions
);

export default withPWA(pwaConfig)(configWithSentry);