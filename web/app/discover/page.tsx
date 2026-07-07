// Discover (/discover) — tìm ASIN top theo Keyword / Category / Dòng sản phẩm, hoặc import CSV H10.
import { DiscoverClient } from "@/components/DiscoverClient";
import { getProductLines, getRecentDiscoverJobs } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const [productLines, jobs] = await Promise.all([
    getProductLines(),
    getRecentDiscoverJobs(10),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">Discover</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          Tìm ASIN bán tốt theo keyword, category hoặc dòng sản phẩm (Sticker, Ornament, Jar, Tumbler…).
          Kết quả có đủ ảnh + link, tự thêm vào danh sách track.
        </p>
      </div>
      <DiscoverClient productLines={productLines} initialJobs={jobs} />
    </div>
  );
}
