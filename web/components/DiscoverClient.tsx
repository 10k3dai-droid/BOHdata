"use client";

// DiscoverClient — container Discover: tab "Tìm sản phẩm" (keyword/category/dòng SP) + "Import CSV".
import { useState } from "react";
import type { DiscoverJob, ProductLine } from "@/lib/types";
import { DiscoverSearch } from "@/components/discover/DiscoverSearch";
import { JobsList } from "@/components/discover/JobsList";
import { CsvImport } from "@/components/discover/CsvImport";

type Tab = "search" | "csv";

export function DiscoverClient({
  productLines,
  initialJobs,
}: {
  productLines: ProductLine[];
  initialJobs: DiscoverJob[];
}) {
  const [tab, setTab] = useState<Tab>("search");
  // Tăng mỗi khi tạo job mới để JobsList refresh ngay.
  const [refreshSignal, setRefreshSignal] = useState(0);

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-line bg-bg-soft p-1">
        <button
          onClick={() => setTab("search")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "search" ? "bg-bg-hover text-ink" : "text-ink-soft hover:text-ink"
          }`}
        >
          Tìm sản phẩm top
        </button>
        <button
          onClick={() => setTab("csv")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "csv" ? "bg-bg-hover text-ink" : "text-ink-soft hover:text-ink"
          }`}
        >
          Import H10 CSV
        </button>
      </div>

      {tab === "search" ? (
        <>
          <DiscoverSearch
            productLines={productLines}
            onSubmitted={() => setRefreshSignal((n) => n + 1)}
          />
          <JobsList initialJobs={initialJobs} refreshSignal={refreshSignal} />
        </>
      ) : (
        <CsvImport />
      )}
    </div>
  );
}
