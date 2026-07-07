// githubDispatch.ts — Kích hoạt GitHub Actions workflow từ web (server-only).
// Web bắn repository_dispatch (event_type=run-discover) → workflow discover.yml chạy crawler trên cloud.
// Best-effort: nếu chưa cấu hình token/repo thì bỏ qua (job vẫn được tạo, chạy tay sau cũng được).
import "server-only";

export interface DispatchResult {
  configured: boolean; // đã cấu hình token + repo chưa
  ok: boolean; // GitHub nhận lệnh chưa (204)
  error?: string;
}

export async function triggerDiscoverWorkflow(): Promise<DispatchResult> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO; // dạng "owner/name", vd "10k3dBOH/BOHdata"

  if (!token || !repo) {
    return { configured: false, ok: false };
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: "run-discover" }),
      cache: "no-store",
    });

    if (res.ok) return { configured: true, ok: true }; // 204 No Content
    const text = await res.text();
    return { configured: true, ok: false, error: `GitHub ${res.status}: ${text.slice(0, 200)}` };
  } catch (e: unknown) {
    return { configured: true, ok: false, error: e instanceof Error ? e.message : "dispatch lỗi" };
  }
}
