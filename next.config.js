const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ship only the icons, animations and chart parts that are actually used.
  experimental: { optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts'] },
}

module.exports = withNextIntl(nextConfig)
