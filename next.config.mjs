/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ESLint version mismatch (eslint-config-next@16 needs ESLint 9, project has 8)
    // Run `next lint` separately; don't block production builds
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
