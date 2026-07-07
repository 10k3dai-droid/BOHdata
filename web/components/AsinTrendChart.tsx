"use client";

// AsinTrendChart — biểu đồ xu hướng BSR / giá / sales_est / review theo thời gian.
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useState } from "react";
import type { Snapshot } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type Metric = { key: keyof Snapshot; label: string; color: string; invert?: boolean };

const METRICS: Metric[] = [
  { key: "bsr", label: "BSR (thấp = tốt)", color: "#38bdf8", invert: true },
  { key: "price", label: "Giá ($)", color: "#2dd4bf" },
  { key: "sales_est", label: "Sales/mo", color: "#34d399" },
  { key: "review_count", label: "Reviews", color: "#fbbf24" },
];

export function AsinTrendChart({ snapshots }: { snapshots: Snapshot[] }) {
  const [active, setActive] = useState<Metric>(METRICS[0]);
  const labels = snapshots.map((s) => s.captured_on);
  const values = snapshots.map((s) => (s[active.key] as number | null) ?? null);

  const data = {
    labels,
    datasets: [
      {
        label: active.label,
        data: values,
        borderColor: active.color,
        backgroundColor: `${active.color}22`,
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
        spanGaps: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#141a23",
        borderColor: "#232c38",
        borderWidth: 1,
        titleColor: "#e7edf5",
        bodyColor: "#9aa7b8",
      },
    },
    scales: {
      x: {
        grid: { color: "#1a222d" },
        ticks: { color: "#5c6a7d", maxRotation: 0, autoSkip: true },
      },
      y: {
        // BSR: đảo trục cho trực quan (rank nhỏ = tốt lên trên).
        reverse: !!active.invert,
        grid: { color: "#1a222d" },
        ticks: { color: "#5c6a7d" },
      },
    },
  };

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.key as string}
            onClick={() => setActive(m)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              active.key === m.key
                ? "border-accent/60 bg-accent/15 text-accent"
                : "border-line bg-bg-soft text-ink-soft hover:text-ink"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="h-[320px]">
        {snapshots.length > 0 ? (
          <Line data={data} options={options} />
        ) : (
          <div className="grid h-full place-items-center text-sm text-ink-soft">
            Chưa có snapshot để vẽ biểu đồ.
          </div>
        )}
      </div>
    </div>
  );
}
