import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Any Supabase project's storage host (artist photos/portfolio media).
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/public/**" },
      // Placeholder avatars/images used by some existing profile data.
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
