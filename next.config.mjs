/** @type {import('next').NextConfig} */

// The creator recorder at /creator/upload is the only surface that calls
// getUserMedia. Every other path keeps the mic disabled; the upload path
// allows it for same-origin frames only.
const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=()"
const RECORDER_PERMISSIONS_POLICY = "camera=(), microphone=(self), geolocation=()"

const securityHeaders = (permissionsPolicy) => [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: permissionsPolicy,
  },
]

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/creator/upload",
        headers: securityHeaders(RECORDER_PERMISSIONS_POLICY),
      },
      {
        // Excluding the upload path here keeps every path on exactly one
        // Permissions-Policy value, instead of depending on how duplicate
        // header keys merge across matching source entries. The lookahead is
        // anchored so a future /creator/upload/<sub> route falls back to the
        // restrictive policy rather than to no headers at all.
        source: "/((?!creator/upload$).*)",
        headers: securityHeaders(PERMISSIONS_POLICY),
      },
    ]
  },
}

export default nextConfig
