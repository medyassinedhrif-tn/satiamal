"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useI18n } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type Listing = {
  id: string;
  title: string;
  description: string;
  cycle: string;
  grade: string;
  subject: string;
  trimester: number | null;
  materialType: string;
  priceTnd: string;
  previewImages: string[];
  isBoosted: boolean;
  seller: { sellerProfile: { slug: string; displayName: string; isVerified: boolean } | null };
};

export default function Home() {
  const { t } = useI18n();
  const materials = [
    ["", t.allMaterials],
    ["joudhadha", t.joudhadha],
    ["devoir", t.devoir],
    ["serie", t.serie],
    ["cours", t.cours],
  ];
  const [listings, setListings] = useState<Listing[]>([]);
  const [query, setQuery] = useState("");
  const [material, setMaterial] = useState("");
  const [cycle, setCycle] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (event?: FormEvent) => {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (material) params.set("material_type", material);
    if (cycle) params.set("cycle", cycle);
    try {
      const response = await fetch(`/api/public/listings?${params}`);
      if (!response.ok) throw new Error("Could not load learning resources.");
      const data = (await response.json()) as { items: Listing[] };
      setListings(data.items);
      setError("");
    } catch {
      setError("The catalog is temporarily unavailable. Please try again.");
    }
  }, [cycle, material, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-[#18332f]">
      <header className="border-b border-[#e1e8df] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-2xl font-black tracking-tight text-[#0e766e]">3alamni<span className="text-[#b5ce59]">.tn</span></Link>
          <nav className="flex items-center gap-3 text-sm font-semibold">
            <LanguageSwitcher />
            <Link href="/login" className="hover:text-[#0e766e]">{t.teacherLogin}</Link>
            <Link href="/register" className="rounded-full bg-[#0e766e] px-4 py-2 text-white hover:bg-[#095c56]">{t.openStore}</Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#123d38] px-5 py-14 text-white sm:py-20">
        <div className="pointer-events-none absolute -right-20 -top-32 h-96 w-96 rounded-full bg-[#b5ce59]/10" />
        <div className="relative mx-auto max-w-7xl">
          <p className="mb-3 text-sm font-bold uppercase tracking-[.2em] text-[#d3e991]">{t.heroEyebrow}</p>
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-6xl">{t.heroTitle}</h1>
          <p className="mt-4 max-w-xl text-lg text-[#d5e4dc]">{t.heroText}</p>
          <form onSubmit={load} className="mt-8 grid gap-3 rounded-2xl bg-white p-3 shadow-xl sm:grid-cols-[1fr_190px_190px_auto]">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchPlaceholder} className="min-h-12 rounded-xl px-4 text-[#18332f] outline-none ring-[#0e766e] focus:ring-2" />
            <select value={cycle} onChange={(event) => setCycle(event.target.value)} className="min-h-12 rounded-xl border border-[#e1e8df] bg-white px-3 text-[#18332f]">
              <option value="">{t.allLevels}</option><option value="primaire">{t.primaire}</option><option value="college">{t.college}</option><option value="lycee">{t.lycee}</option>
            </select>
            <select value={material} onChange={(event) => setMaterial(event.target.value)} className="min-h-12 rounded-xl border border-[#e1e8df] bg-white px-3 text-[#18332f]">
              {materials.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button className="min-h-12 rounded-xl bg-[#b5ce59] px-7 font-bold text-[#18332f] hover:bg-[#c4da75]">{t.search}</button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="mb-6 flex items-end justify-between">
          <div><p className="text-sm font-bold uppercase tracking-widest text-[#7b928a]">{t.collection}</p><h2 className="mt-1 text-2xl font-extrabold">{t.community}</h2></div>
          <span className="text-sm text-[#7b928a]">{listings.length} {t.resources}</span>
        </div>
        {error && <div role="alert" className="mb-6 rounded-xl bg-amber-50 p-4 text-amber-900">{error}</div>}
        {!error && listings.length === 0 && <div className="rounded-2xl border border-dashed border-[#cbd8ce] bg-white p-10 text-center text-[#657c74]">{t.noResults}</div>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl border border-[#e1e8df] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <Link href={`/listings/${item.id}`} className="block">
                <div className="relative aspect-[16/10] bg-[#e6eee8]">
                  {item.previewImages[0] && <Image src={item.previewImages[0]} alt="" fill unoptimized className="object-cover" />}
                  {item.isBoosted && <span className="absolute left-3 top-3 rounded-full bg-[#b5ce59] px-3 py-1 text-xs font-bold">{t.featured}</span>}
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#54736a]"><span>{item.cycle}</span><span>·</span><span>{item.grade}</span><span>·</span><span>{item.subject}</span></div>
                  <h3 dir="auto" className="mt-3 line-clamp-2 text-lg font-bold">{item.title}</h3>
                  <p dir="auto" className="mt-2 line-clamp-2 text-sm text-[#71847d]">{item.description}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-[#edf0eb] pt-4">
                    <span dir="auto" className="font-bold">{item.seller.sellerProfile?.displayName ?? t.sharedBy} {item.seller.sellerProfile?.isVerified && <span aria-label={t.verified} className="text-[#0e766e]">✓</span>}</span>
                    <span className="text-xl font-black text-[#0e766e]">{item.priceTnd} <small className="text-xs">TND</small></span>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <footer className="mt-10 border-t border-[#e1e8df] bg-white px-5 py-8 text-center text-sm text-[#71847d]">3alamni.tn · A marketplace for Tunisia’s teaching community</footer>
    </main>
  );
}
