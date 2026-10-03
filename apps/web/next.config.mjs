/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source directly.
  transpilePackages: ["@pass/contracts", "@pass/ui"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;