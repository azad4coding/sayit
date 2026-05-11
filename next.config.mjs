/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@capacitor/core', '@capacitor/preferences'],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
          { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
