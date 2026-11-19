"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DashboardSubpageHeader } from "@/components/DashboardSubpageHeader";
import { useI18n } from "@/i18n";

type Resource = {
  id: string;
  title: string;
  grade: string;
  subject: string;
  priceTnd: string;
  status: string;
  contactClicks: number;
  createdAt: string;
};
type ResourceMetric = { listingId: string; downloads: number; estimatedGrossTnd: number };

export default function ResourcesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [resources, setResources] = useState<Resource[]>([]);
  const [metrics, setMetrics] = useState<ResourceMetric[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([fetch("/api/seller/listings"), fetch("/api/seller/analytics")]).then(async ([listingsResponse, analyticsResponse]) => {
      if (listingsResponse.status === 401 || analyticsResponse.status === 401) {
        router.push("/login");
        return null;
      }
      if (!listingsResponse.ok || !analyticsResponse.ok) throw new Error(t.dashboardError);
      return await Promise.all([listingsResponse.json(), analyticsResponse.json()]) as [Resource[], { resources: ResourceMetric[] }];
    }).then((result) => {
      if (active && result) {
        setResources(result[0]);
        setMetrics(result[1].resources);
      }
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t.dashboardError); });
    return () => { active = false; };
  }, [router, t.dashboardError]);

  const visible = useMemo(() => resources.filter((item) => {
    const matchesQuery = `${item.title} ${item.grade} ${item.subject}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    return matchesQuery && (status === "ALL" || item.status === status);
  }), [query, resources, status]);
  const metricById = new Map(metrics.map((metric) => [metric.listingId, metric]));
  const activeCount = resources.filter((item) => item.status === "ACTIVE").length;
  const clicks = resources.reduce((sum, item) => sum + item.contactClicks, 0);

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-5 py-7 text-[#18332f]">
      <div className="mx-auto max-w-7xl">
        <DashboardSubpageHeader title={t.resourcesPage} />
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          {[[t.yourListings, resources.length, "bg-[#e2f2eb]"], [t.activeListings, activeCount, "bg-[#eff4d8]"], [t.contactClicks, clicks, "bg-[#e8eefb]"]].map(([label, value, tone]) =>
            <article key={label} className="rounded-2xl border border-[#e1e8df] bg-white p-5 shadow-sm"><span aria-hidden="true" className={`mb-4 block h-2 w-14 rounded-full ${tone}`} /><p className="text-sm text-[#71847d]">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></article>
          )}
        </section>
        <section className="mt-6 rounded-2xl border border-[#e1e8df] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><h2 className="text-xl font-extrabold">{t.yourListings}</h2><p className="mt-1 text-sm text-[#71847d]">{visible.length} / {resources.length}</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchPlaceholder} className="min-h-11 rounded-xl border border-[#dce5dd] px-3 text-sm outline-none focus:border-[#0e766e]" />
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-xl border border-[#dce5dd] bg-white px-3 text-sm">
                <option value="ALL">{t.allStatuses}</option><option value="ACTIVE">{t.activeStatus}</option><option value="HIDDEN">{t.hiddenStatus}</option>
              </select>
              <Link href="/dashboard#publish" className="grid min-h-11 place-items-center rounded-xl bg-[#0e766e] px-4 text-sm font-bold text-white">{t.publishResource} +</Link>
            </div>
          </div>
          {!visible.length && <div className="mt-5 rounded-xl border border-dashed border-[#d6e1d8] p-10 text-center text-sm text-[#71847d]">{resources.length ? t.noResults : t.loading}</div>}
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {visible.map((item, index) => {
              const metric = metricById.get(item.id);
              return <article key={item.id} className="rounded-2xl border border-[#e7ece5] bg-[#fbfcfa] p-4 transition hover:border-[#c5d8ca] hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-black ${index % 3 === 0 ? "bg-[#e2f2eb] text-[#0e766e]" : index % 3 === 1 ? "bg-[#f3e8ef] text-[#85556f]" : "bg-[#eff4d8] text-[#687c30]"}`}>PDF</span>
                    <div className="min-w-0"><h3 dir="auto" className="truncate font-extrabold">{item.title}</h3><p className="mt-1 truncate text-xs text-[#71847d]">{item.grade} · {item.subject}</p></div>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${item.status === "ACTIVE" ? "bg-[#e2f2eb] text-[#0e766e]" : "bg-[#f0f1ee] text-[#71847d]"}`}>{item.status === "ACTIVE" ? t.activeStatus : t.hiddenStatus}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#e7ece5] pt-3">
                  <div><p className="text-[11px] text-[#71847d]">{t.resourceDownloads}</p><p className="mt-1 font-black">{metric?.downloads ?? 0}</p></div>
                  <div><p className="text-[11px] text-[#71847d]">{t.resourceViews}</p><p className="mt-1 font-black">{item.contactClicks}</p></div>
                  <div><p className="text-[11px] text-[#71847d]">{t.price}</p><p className="mt-1 font-black">{item.priceTnd} TND</p></div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-[#71847d]">{t.resourceRevenue}: {(metric?.estimatedGrossTnd ?? 0).toFixed(2)} TND</span>
                  <div className="flex gap-2"><Link href={`/listings/${item.id}`} className="rounded-lg border border-[#dce5dd] px-3 py-2 text-xs font-bold text-[#0e766e]">{t.viewListing}</Link><Link href="/dashboard" className="rounded-lg border border-[#dce5dd] px-3 py-2 text-xs font-bold">{t.editAction}</Link></div>
                </div>
              </article>;
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
