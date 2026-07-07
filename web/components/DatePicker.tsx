"use client";

// DatePicker — chọn 1 ngày cụ thể để xem snapshot của ngày đó.
// Đổi ngày → cập nhật ?date= trên URL → server component re-query.
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function DatePicker({
  selected,
  availableDates,
}: {
  selected: string;
  availableDates: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const setDate = useCallback(
    (date: string) => {
      const next = new URLSearchParams(params.toString());
      if (date) next.set("date", date);
      else next.delete("date");
      router.push(`/?${next.toString()}`);
    },
    [params, router]
  );

  const min = availableDates.length ? availableDates[availableDates.length - 1] : undefined;
  const max = availableDates.length ? availableDates[0] : undefined;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="label" htmlFor="date">
          Ngày snapshot
        </label>
        <input
          id="date"
          type="date"
          value={selected}
          min={min}
          max={max}
          onChange={(e) => setDate(e.target.value)}
          className="input [color-scheme:dark]"
        />
      </div>

      {/* Nút nhảy nhanh tới các ngày gần nhất có data. */}
      {availableDates.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {availableDates.slice(0, 5).map((d) => (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                d === selected
                  ? "border-accent/60 bg-accent/15 text-accent"
                  : "border-line bg-bg-soft text-ink-soft hover:text-ink"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
