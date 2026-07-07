// parseCsv.ts — Parse CSV Helium 10 phía client, trích cột ASIN.
// Đủ dùng cho export H10 (Black Box/Cerebro/Xray); không cần thư viện CSV nặng.

const ASIN_RE = /^[A-Z0-9]{10}$/;
const ASIN_HEADERS = new Set(["asin", "asins", "product asin"]);

/** Tách 1 dòng CSV thành các ô, xử lý ô có dấu ngoặc kép và dấu phẩy bên trong. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

/** Trích danh sách ASIN duy nhất từ nội dung CSV. */
export function extractAsinsFromCsv(text: string): string[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const asinCol = headers.findIndex((h) => ASIN_HEADERS.has(h));

  const seen = new Set<string>();
  const asins: string[] = [];

  const add = (raw: string) => {
    const v = raw.trim().toUpperCase();
    if (ASIN_RE.test(v) && !seen.has(v)) {
      seen.add(v);
      asins.push(v);
    }
  };

  if (asinCol >= 0) {
    for (let i = 1; i < lines.length; i++) {
      const cells = splitCsvLine(lines[i]);
      if (asinCol < cells.length) add(cells[asinCol]);
    }
  } else {
    // Không có header ASIN rõ ràng → quét mọi ô.
    for (const line of lines) {
      for (const cell of splitCsvLine(line)) add(cell);
    }
  }

  return asins;
}
