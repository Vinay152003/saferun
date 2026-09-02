/** @type {import('next').NextConfig} */
const nextConfig = {
  // saferun-core is an ESM package outside this app dir; let Next bundle it
  // for the server routes.
  transpilePackages: ["saferun-core"],
  poweredByHeader: false, // don't advertise the framework
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
