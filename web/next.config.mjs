/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Ảnh sản phẩm lấy từ CDN Amazon; cho phép hiển thị (dùng thẻ <img> nên chủ yếu để tham chiếu).
    remotePatterns: [
      { protocol: "https", hostname: "images-na.ssl-images-amazon.com" },
      { protocol: "https", hostname: "m.media-amazon.com" },
    ],
  },
};

export default nextConfig;
