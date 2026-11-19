"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Store = {
  slug: string; displayName: string; bio: string | null; isVerified: boolean;
  listings: Array<{ id: string; title: string; cycle: string; grade: string; subject: string; trimester: number | null; materialType: string; priceTnd: string; previewImages: string[] }>;
};

export default function StorePage() {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [grade, setGrade] = useState("");
  const [trimester, setTrimester] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const query = new URLSearchParams();
    if (grade) query.set("grade", grade);
    if (trimester) query.set("trimester", trimester);
    fetch(`/api/public/stores/${encodeURIComponent(slug)}?${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Store not found.");
        setStore((await response.json()) as Store);
      })
      .catch((reason: Error) => setError(reason.message));
  }, [slug, grade, trimester]);

  if (!store) return <main className="mx-auto max-w-6xl px-5 py-16">{error || "Loading teacher store…"}</main>;
  return (
    <main className="min-h-screen bg-[#f7f8f4] px-5 py-8 text-[#18332f]">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="font-bold text-[#0e766e]">← 3alamni.tn</Link>
        <section className="mt-6 rounded-3xl bg-[#123d38] px-7 py-10 text-white sm:px-12">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d3e991]">Teacher storefront</p>
          <h1 dir="auto" className="mt-3 text-4xl font-black">{store.displayName} {store.isVerified && <span className="text-[#b5ce59]">✓</span>}</h1>
          <p dir="auto" className="mt-3 max-w-2xl text-[#d5e4dc]">{store.bio || "Browse this teacher’s classroom resources."}</p>
        </section>
        <div className="my-7 flex flex-wrap gap-3">
          <input value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="Filter by grade" className="rounded-xl border border-[#dce5dd] bg-white px-4 py-3" />
          <select value={trimester} onChange={(event) => setTrimester(event.target.value)} className="rounded-xl border border-[#dce5dd] bg-white px-4 py-3"><option value="">All trimesters</option><option value="1">Trimester 1</option><option value="2">Trimester 2</option><option value="3">Trimester 3</option></select>
        </div>
        {store.listings.length === 0 ? <p className="rounded-2xl bg-white p-8 text-center text-[#71847d]">No resources found for these filters.</p> : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {store.listings.map((item) => <Link key={item.id} href={`/listings/${item.id}`} className="overflow-hidden rounded-2xl border border-[#e1e8df] bg-white transition hover:-translate-y-1 hover:shadow-lg">
              <div className="relative aspect-[16/10] bg-[#e6eee8]">{item.previewImages[0] && <Image src={item.previewImages[0]} alt="" fill unoptimized className="object-cover" />}</div>
              <div className="p-5"><p dir="auto" className="text-xs font-bold uppercase text-[#6c867d]">{item.grade} · {item.subject}{item.trimester ? ` · T${item.trimester}` : ""}</p><h2 dir="auto" className="mt-2 font-bold">{item.title}</h2><p className="mt-3 font-black text-[#0e766e]">{item.priceTnd} TND</p></div>
            </Link>)}
          </div>
        )}
      </div>
    </main>
  );
}
