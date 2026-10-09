/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',   // static HTML export (replaces `next export` CLI removed in Next 14)
  trailingSlash: true, // ensures Amplify SPA routing works correctly
};

module.exports = nextConfig;
