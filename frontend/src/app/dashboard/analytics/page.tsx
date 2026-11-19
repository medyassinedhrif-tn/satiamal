"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardSubpageHeader } from "@/components/DashboardSubpageHeader";
import { useI18n } from "@/i18n";

type Analytics = {
  downloadsAllTime: number;
  downloadsThisMonth: number;
  codesGeneratedThisMonth: number;
  estimatedGrossTnd: number;
  weeklyDownloads: { date: string; downloads: number }[];
  topListings: { listingId: string; title: string; downloads: number; contactClicks: number; estimatedGrossTnd: number }[];
};

export default function AnalyticsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/seller/analytics").then(async (response) => {
      if (response.status === 401) {
        router.push("/login");
        return null;
      }
      if (!response.ok) throw new Error(t.dashboardError);
      return await response.json() as Analytics;
    }).then((result) => { if (active && result) setData(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t.dashboardError); });
    return () => { active = false; };
  }, [router, t.dashboardError]);

  const maxDownloads = Math.max(1, ...(data?.weeklyDownloads.map((day) => day.downloads) ?? [0]));
  return (
    <main className="min-h-screen bg-[#f7f8f4] px-5 py-7 text-[#18332f]">
      <div className="mx-auto max-w-7xl">
        <DashboardSubpageHeader title={t.analytics} />
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [t.downloadsThisMonth, data?.downloadsThisMonth, "bg-[#e2f2eb]", "↓"],
            [t.downloadsAllTime, data?.downloadsAllTime, "bg-[#e8eefb]", "▥"],
            [t.codesThisMonth, data?.codesGeneratedThisMonth, "bg-[#f3e8ef]", "⌁"],
            [t.estimatedGross, data ? `${data.estimatedGrossTnd.toFixed(2)} TND` : "—", "bg-[#eff4d8]", "◈"],
          ].map(([label, value, color, icon]) => (
            <article key={label} className="rounded-2xl border border-[#e1e8df] bg-white p-5 shadow-sm">
              <span aria-hidden="true" className={`grid h-11 w-11 place-items-center rounded-xl text-xl font-black text-[#0e766e] ${color}`}>{icon}</span>
              <p className="mt-4 text-sm text-[#71847d]">{label}</p>
              <p className="mt-1 text-2xl font-black">{value ?? "—"}</p>
            </article>
          ))}
        </section>
        <p className="mt-3 text-xs leading-5 text-[#71847d]">{t.estimateDisclaimer}</p>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <article className="rounded-2xl border border-[#e1e8df] bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-extrabold">{t.weeklyDownloads}</h2><p className="mt-1 text-sm text-[#71847d]">{t.downloadsThisMonth}: {data?.downloadsThisMonth ?? "—"}</p></div>
              <span className="rounded-full bg-[#e6f3eb] px-3 py-1 text-xs font-bold text-[#0e766e]">7 days</span>
            </div>
            {data?.weeklyDownloads.some((day) => day.downloads > 0) ? (
              <div className="mt-7 flex h-56 items-end gap-2 sm:gap-4" role="img" aria-label={t.weeklyDownloads}>
                {data.weeklyDownloads.map((day) => (
                  <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-xs font-bold text-[#507067]">{day.downloads}</span>
                    <div className="flex h-[78%] w-full items-end rounded-t-xl bg-[#f0f5ee]">
                      <div className="w-full rounded-t-xl bg-gradient-to-t from-[#0e766e] to-[#b5ce59] transition-all" style={{ height: `${Math.max(4, day.downloads / maxDownloads * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-[#71847d] sm:text-xs">{day.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            ) : <div className="mt-7 grid min-h-48 place-items-center rounded-xl border border-dashed border-[#d6e1d8] bg-[#fafbf8] px-6 text-center text-sm text-[#71847d]">{data ? t.noAnalytics : t.loading}</div>}
          </article>

          <article className="rounded-2xl border border-[#e1e8df] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-extrabold">{t.topResources}</h2><Link href="/dashboard/resources" className="text-sm font-bold text-[#0e766e]">{t.resourcesPage} →</Link></div>
            {data?.topListings.length ? <ol className="mt-5 space-y-4">{data.topListings.map((item, index) => {
              const share = item.downloads / Math.max(1, data.topListings[0].downloads) * 100;
              return <li key={item.listingId}>
                <div className="flex items-start justify-between gap-3"><span className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eff4d8] text-sm font-black text-[#53712e]">{index + 1}</span><span dir="auto" className="truncate text-sm font-bold">{item.title}</span></span><span className="shrink-0 text-sm font-black">{item.downloads}</span></div>
                <div className="ms-11 mt-2 h-2 overflow-hidden rounded-full bg-[#edf1ea]"><div className="h-full rounded-full bg-[#0e766e]" style={{ width: `${share}%` }} /></div>
              </li>;
            })}</ol> : <div className="mt-5 grid min-h-48 place-items-center rounded-xl border border-dashed border-[#d6e1d8] px-6 text-center text-sm text-[#71847d]">{data ? t.noAnalytics : t.loading}</div>}
          </article>
        </section>
      </div>
    </main>
  );
}
