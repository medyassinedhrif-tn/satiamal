"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DashboardSubpageHeader } from "@/components/DashboardSubpageHeader";
import { useI18n } from "@/i18n";

type DownloadCode = {
  id: string;
  code: string;
  listingId: string;
  buyerPhone: string;
  buyerNote: string | null;
  downloadCount: number;
  maxDownloads: number;
  expiresAt: string | null;
  isRevoked: boolean;
  createdAt: string;
};
type Listing = { id: string; title: string };

function csrfToken() {
  return document.cookie.split("; ").find((cookie) => cookie.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

export default function CodesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [codesData, setCodesData] = useState<{ items: DownloadCode[]; now: number }>({ items: [], now: 0 });
  const [listings, setListings] = useState<Listing[]>([]);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const codes = codesData.items;

  async function load(searchPhone = "") {
    const [codeResponse, listingResponse] = await Promise.all([
      fetch(`/api/seller/codes${searchPhone ? `?phone=${encodeURIComponent(searchPhone)}` : ""}`),
      fetch("/api/seller/listings"),
    ]);
    if (codeResponse.status === 401 || listingResponse.status === 401) {
      router.push("/login");
      return;
    }
    if (!codeResponse.ok || !listingResponse.ok) throw new Error(t.dashboardError);
    setCodesData({ items: await codeResponse.json() as DownloadCode[], now: Date.now() });
    setListings(await listingResponse.json() as Listing[]);
  }

  useEffect(() => {
    let active = true;
    void Promise.all([fetch("/api/seller/codes"), fetch("/api/seller/listings")]).then(async ([codeResponse, listingResponse]) => {
      if (codeResponse.status === 401 || listingResponse.status === 401) {
        router.push("/login");
        return null;
      }
      if (!codeResponse.ok || !listingResponse.ok) throw new Error(t.dashboardError);
      return await Promise.all([codeResponse.json(), listingResponse.json()]) as [DownloadCode[], Listing[]];
    }).then((result) => {
      if (active && result) {
        setCodesData({ items: result[0], now: Date.now() });
        setListings(result[1]);
      }
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t.dashboardError); });
    return () => { active = false; };
  }, [router, t.dashboardError]);

  async function search(event: FormEvent) {
    event.preventDefault();
    try { await load(phone.trim()); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t.dashboardError); }
  }

  async function revoke(id: string) {
    const response = await fetch(`/api/seller/codes/${id}/revoke`, {
      method: "PATCH",
      headers: { "x-csrf-token": csrfToken(), "content-type": "application/json" },
      body: "{}",
    });
    if (!response.ok) {
      setError("Could not revoke this code.");
      return;
    }
    setMessage(t.revokedStatus);
    await load(phone.trim());
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setMessage(t.copyCode);
      setError("");
    } catch {
      setError("Clipboard access is unavailable in this browser.");
    }
  }

  function status(code: DownloadCode) {
    if (code.isRevoked) return t.revokedStatus;
    if (code.expiresAt && Date.parse(code.expiresAt) <= codesData.now) return t.expiredStatus;
    if (code.downloadCount > 0) return t.downloadedStatus;
    return t.unusedStatus;
  }

  const listingTitle = (listingId: string) => listings.find((listing) => listing.id === listingId)?.title ?? "—";
  return (
    <main className="min-h-screen bg-[#f7f8f4] px-5 py-7 text-[#18332f]">
      <div className="mx-auto max-w-7xl">
        <DashboardSubpageHeader title={t.codesPage} />
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
        {message && <p role="status" className="mt-5 rounded-xl bg-[#e2f2eb] p-4 text-[#0e766e]">{message}</p>}
        <section className="mt-6 rounded-2xl border border-[#e1e8df] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-xl font-extrabold">{t.codeHistory}</h2><p className="mt-1 text-sm text-[#71847d]">{codes.length} codes</p></div>
            <form onSubmit={search} className="flex gap-2">
              <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder={t.filterCodes} className="min-w-0 flex-1 rounded-xl border border-[#dce5dd] px-3 py-3 text-sm sm:w-72" />
              <button className="rounded-xl bg-[#123d38] px-4 py-3 text-sm font-bold text-white">{t.searchAction}</button>
            </form>
          </div>
          {!codes.length && <div className="mt-5 rounded-xl border border-dashed border-[#d6e1d8] p-10 text-center text-sm text-[#71847d]">{t.noAnalytics}</div>}
          <div className="mt-5 space-y-3">
            {codes.map((item) => {
              const statusText = status(item);
              return <article key={item.id} className="grid gap-4 rounded-2xl border border-[#e7ece5] bg-[#fbfcfa] p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><code className="rounded-lg bg-[#123d38] px-3 py-1.5 font-mono text-lg font-black tracking-wider text-white">{item.code}</code><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.isRevoked ? "bg-red-50 text-red-700" : item.downloadCount > 0 ? "bg-[#e2f2eb] text-[#0e766e]" : "bg-[#eff4d8] text-[#687c30]"}`}>{statusText}</span></div>
                  <p dir="auto" className="mt-3 truncate font-bold">{listingTitle(item.listingId)}{item.buyerNote ? ` · ${item.buyerNote}` : ""}</p>
                  <p className="mt-1 text-xs text-[#71847d]">{item.buyerPhone} · {new Date(item.createdAt).toLocaleDateString()} · {item.downloadCount}/{item.maxDownloads}</p>
                  {item.expiresAt && <p className="mt-1 text-xs text-[#71847d]">{t.expiresAt}: {new Date(item.expiresAt).toLocaleString()}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => void copy(item.code)} className="rounded-xl border border-[#dce5dd] px-3 py-2 text-sm font-bold">{t.copyCode}</button>
                  <button onClick={() => window.open(`https://wa.me/${item.buyerPhone}?text=${encodeURIComponent(`${item.code}\n${window.location.origin}/listings/${item.listingId}`)}`, "_blank", "noopener,noreferrer")} className="rounded-xl bg-[#e2f2eb] px-3 py-2 text-sm font-bold text-[#0e766e]">{t.shareWhatsApp}</button>
                  {!item.isRevoked && <button onClick={() => void revoke(item.id)} className="rounded-xl border border-red-100 px-3 py-2 text-sm font-bold text-red-700">{t.revokeAction}</button>}
                </div>
              </article>;
            })}
          </div>
          <div className="mt-5 rounded-xl bg-[#f2f6ec] p-4 text-sm text-[#58736a]">
            <strong>{t.codePacks}:</strong> 15 codes · 15 TND · 50 codes · 35 TND · 100 codes · 50 TND
          </div>
        </section>
      </div>
    </main>
  );
}
