import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep the Postgres driver out of the bundler; it is loaded at runtime.
  serverExternalPackages: ['@prisma/adapter-pg', 'pg'],
}

export default nextConfig
