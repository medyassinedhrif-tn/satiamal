"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type Topup = {
  id: string; topupType: string; packCodes: number | null; boostDays: number | null;
  amountTnd: string; paymentMethod: string; receiptRef: string; status: string;
  seller: { id: string; email: string; sellerProfile: { displayName: string; slug: string } | null };
};
type Report = { id: string; reason: string; details: string | null; status: string; listing: { id: string; title: string; status: string } };
type Seller = { id: string; email: string; sellerProfile: { slug: string; displayName: string; isVerified: boolean } | null };
type Listing = { id: string; title: string; grade: string; subject: string; status: "ACTIVE" | "HIDDEN"; seller: { sellerProfile: { displayName: string; slug: string } | null } };

function csrfToken() {
  return document.cookie.split("; ").find((cookie) => cookie.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

export default function AdminPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [topups, setTopups] = useState<Topup[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createdSeller, setCreatedSeller] = useState<{ email: string; slug: string } | null>(null);

  const load = useCallback(async () => {
    const responses = await Promise.all([
      fetch("/api/admin/topups?status=PENDING"),
      fetch("/api/admin/reports?status=OPEN"),
      fetch("/api/admin/sellers"),
      fetch("/api/admin/listings"),
    ]);
    if (responses.some((response) => response.status === 401 || response.status === 403)) {
      router.push("/login");
      return;
    }
    if (responses.some((response) => !response.ok)) throw new Error("Could not load the admin queue.");
    setTopups((await responses[0].json()) as Topup[]);
    setReports((await responses[1].json()) as Report[]);
    setSellers((await responses[2].json()) as Seller[]);
    setListings((await responses[3].json()) as Listing[]);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((reason: Error) => setError(reason.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function mutate(url: string, method: string, body: object) {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken() },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({})) as { message?: string };
    if (!response.ok) throw new Error(result.message ?? "Action failed.");
  }

  async function reviewTopup(id: string, status: "APPROVED" | "REJECTED") {
    try {
      await mutate(`/api/admin/topups/${id}/review`, "PATCH", { status });
      setMessage(`Top-up ${status.toLowerCase()}.`);
      setError("");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not review top-up."); }
  }

  async function closeReport(id: string, status: "RESOLVED" | "DISMISSED") {
    try {
      await mutate(`/api/admin/reports/${id}`, "PATCH", { status });
      setMessage(`Report ${status.toLowerCase()}.`);
      setError("");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update report."); }
  }

  async function verifySeller(seller: Seller) {
    try {
      await mutate(`/api/admin/sellers/${seller.id}/verify`, "PATCH", { isVerified: !seller.sellerProfile?.isVerified });
      setMessage(`${seller.sellerProfile?.displayName ?? seller.email} verification updated.`);
      setError("");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update verification."); }
  }

  async function moderateListing(item: Listing) {
    const status = item.status === "ACTIVE" ? "HIDDEN" : "ACTIVE";
    try {
      await mutate(`/api/admin/listings/${item.id}/moderate`, "PATCH", { status });
      setMessage(`Listing ${status.toLowerCase()}.`);
      setError("");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not moderate listing."); }
  }

  async function createConciergeSeller(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("listingTitle") ?? "").trim();
    const previews = data.getAll("listingPreviews").filter((file): file is File => file instanceof File && file.size > 0);
    const pdf = data.get("listingPdf");
    const hasListing = Boolean(title);
    if (hasListing && (previews.length < 1 || previews.length > 4 || !(pdf instanceof File) || !pdf.size)) {
      setError("An initial listing needs 1–4 preview images and one PDF.");
      return;
    }
    if (!hasListing && (previews.length || (pdf instanceof File && pdf.size))) {
      setError("Enter an initial listing title or remove its files.");
      return;
    }
    const listingFields = ["listingDescription", "listingCycle", "listingGrade", "listingSubject", "listingTrimester", "listingMaterialType", "listingPrice"];
    if (hasListing) {
      data.set("initialListings", JSON.stringify([{
        title,
        description: data.get("listingDescription"),
        cycle: data.get("listingCycle"),
        grade: data.get("listingGrade"),
        subject: data.get("listingSubject"),
        trimester: data.get("listingTrimester") || undefined,
        materialType: data.get("listingMaterialType"),
        priceTnd: data.get("listingPrice"),
      }]));
      for (const field of [...listingFields, "listingTitle", "listingPreviews", "listingPdf"]) data.delete(field);
      for (const preview of previews) data.append("listing_0_previews", preview);
      if (pdf instanceof File) data.append("listing_0_pdf", pdf);
    } else {
      for (const field of listingFields) data.delete(field);
      data.delete("listingTitle");
      data.delete("listingPreviews");
      data.delete("listingPdf");
    }
    try {
      const response = await fetch("/api/admin/concierge-seller", {
        method: "POST",
        headers: { "x-csrf-token": csrfToken() },
        body: data,
      });
      const result = await response.json() as { message?: string; email?: string; sellerProfile?: { slug: string } };
      if (!response.ok) throw new Error(result.message ?? "Could not create concierge seller.");
      setCreatedSeller({ email: result.email ?? "", slug: result.sellerProfile?.slug ?? "" });
      setMessage(hasListing ? "Seller store and initial listing created." : "Seller store created.");
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create concierge seller."); }
  }

  return <main className="min-h-screen bg-[#f7f8f4] px-5 py-7 text-[#18332f]">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center justify-between"><Link href="/" className="text-xl font-black text-[#0e766e]">3alamni.tn</Link><div className="flex items-center gap-3"><LanguageSwitcher /><Link href="/dashboard" className="text-sm font-bold text-[#0e766e]">{t.sellerPortal}</Link></div></header>
      <p className="mt-8 text-sm font-bold uppercase tracking-widest text-[#7b928a]">{t.admin}</p>
      <h1 className="text-3xl font-black">{t.reviewQueue}</h1>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-emerald-900">{message}</p>}
      {createdSeller && <p className="mt-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">Account: <b>{createdSeller.email}</b> · Store: <Link className="font-bold underline" href={`/s/${createdSeller.slug}`}>/{createdSeller.slug}</Link>. Hand credentials to the teacher securely.</p>}
      <section className="mt-7 rounded-2xl border border-[#e1e8df] bg-white p-6">
        <h2 className="text-xl font-extrabold">{t.paymentRequestsCount} <span className="text-sm text-[#71847d]">({topups.length})</span></h2>
        <div className="mt-4 space-y-3">{topups.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#f6f8f3] p-4">
          <div><p className="font-bold">{item.seller.sellerProfile?.displayName ?? item.seller.email} · {item.topupType === "CODE_PACK" ? `${item.packCodes} codes` : `${item.boostDays} day boost`}</p><p className="mt-1 text-sm text-[#71847d]">{item.amountTnd} TND via {item.paymentMethod} · {item.receiptRef}</p></div>
          <div className="flex gap-2"><button onClick={() => void reviewTopup(item.id, "APPROVED")} className="rounded-lg bg-[#0e766e] px-3 py-2 text-sm font-bold text-white">Approve</button><button onClick={() => void reviewTopup(item.id, "REJECTED")} className="rounded-lg border border-[#dce5dd] px-3 py-2 text-sm font-bold">Reject</button></div>
        </article>)}</div>
        {topups.length === 0 && <p className="mt-3 text-sm text-[#71847d]">{t.noPendingTopups}</p>}
      </section>
      <section className="mt-6 rounded-2xl border border-[#e1e8df] bg-white p-6">
        <h2 className="text-xl font-extrabold">Listing reports <span className="text-sm text-[#71847d]">({reports.length})</span></h2>
        <div className="mt-4 space-y-3">{reports.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#f6f8f3] p-4">
          <div><p className="font-bold">{item.reason} · {item.listing.title}</p><p className="mt-1 text-sm text-[#71847d]">{item.details || "No details provided"}</p><Link href={`/listings/${item.listing.id}`} className="text-sm font-bold text-[#0e766e]">View listing</Link></div>
          <div className="flex gap-2"><button onClick={() => void closeReport(item.id, "RESOLVED")} className="rounded-lg bg-[#0e766e] px-3 py-2 text-sm font-bold text-white">Resolve</button><button onClick={() => void closeReport(item.id, "DISMISSED")} className="rounded-lg border border-[#dce5dd] px-3 py-2 text-sm font-bold">Dismiss</button></div>
        </article>)}</div>
        {reports.length === 0 && <p className="mt-3 text-sm text-[#71847d]">{t.noPendingReports}</p>}
      </section>
      <section className="mt-6 rounded-2xl border border-[#e1e8df] bg-white p-6">
        <h2 className="text-xl font-extrabold">{t.teacherVerificationTitle}</h2>
        <div className="mt-4 space-y-3">{sellers.map((seller) => <article key={seller.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f6f8f3] p-4"><div><p className="font-bold">{seller.sellerProfile?.displayName ?? seller.email}</p><p className="text-sm text-[#71847d]">{seller.email} · /s/{seller.sellerProfile?.slug}</p></div><button onClick={() => void verifySeller(seller)} className="rounded-lg border border-[#dce5dd] px-3 py-2 text-sm font-bold">{seller.sellerProfile?.isVerified ? "Remove verification" : "Verify teacher"}</button></article>)}</div>
      </section>
      <section className="mt-6 rounded-2xl border border-[#e1e8df] bg-white p-6">
        <h2 className="text-xl font-extrabold">{t.listingModerationTitle}</h2>
        <div className="mt-4 space-y-3">{listings.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f6f8f3] p-4"><div><p className="font-bold">{item.title}</p><p className="text-sm text-[#71847d]">{item.seller.sellerProfile?.displayName} · {item.grade} · {item.subject} · {item.status}</p></div><button onClick={() => void moderateListing(item)} className="rounded-lg border border-[#dce5dd] px-3 py-2 text-sm font-bold">{item.status === "ACTIVE" ? "Hide listing" : "Restore listing"}</button></article>)}</div>
      </section>
      <section className="mt-6 rounded-2xl border border-[#e1e8df] bg-white p-6">
        <h2 className="text-xl font-extrabold">{t.conciergeTitle}</h2>
        <p className="mt-2 text-sm text-[#71847d]">{t.conciergeIntro}</p>
        <form onSubmit={createConciergeSeller} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input required name="displayName" placeholder="Teacher display name" className="rounded-xl border border-[#dce5dd] px-3 py-3" />
          <input required name="slug" pattern="[a-z0-9-]{3,60}" placeholder="Store slug" className="rounded-xl border border-[#dce5dd] px-3 py-3" />
          <input required type="email" name="email" placeholder="Login email" className="rounded-xl border border-[#dce5dd] px-3 py-3" />
          <input required minLength={12} type="password" name="password" placeholder="Temporary password (12+ characters)" className="rounded-xl border border-[#dce5dd] px-3 py-3" />
          <input required name="whatsapp" placeholder="WhatsApp number" className="rounded-xl border border-[#dce5dd] px-3 py-3" />
          <input name="bio" maxLength={300} placeholder="Short store bio (optional)" className="rounded-xl border border-[#dce5dd] px-3 py-3" />
          <h3 className="font-bold sm:col-span-2">Optional initial listing</h3>
          <input name="listingTitle" placeholder="Listing title" className="rounded-xl border border-[#dce5dd] px-3 py-3 sm:col-span-2" />
          <textarea name="listingDescription" placeholder="Description" className="min-h-20 rounded-xl border border-[#dce5dd] px-3 py-3 sm:col-span-2" />
          <select name="listingCycle" className="rounded-xl border border-[#dce5dd] bg-white px-3 py-3"><option value="primaire">Primaire</option><option value="college">Collège</option><option value="lycee">Lycée</option></select>
          <input name="listingGrade" placeholder="Grade" className="rounded-xl border border-[#dce5dd] px-3 py-3" />
          <input name="listingSubject" placeholder="Subject" className="rounded-xl border border-[#dce5dd] px-3 py-3" />
          <select name="listingMaterialType" className="rounded-xl border border-[#dce5dd] bg-white px-3 py-3"><option value="joudhadha">Joudhadha</option><option value="devoir">Devoir</option><option value="serie">Series</option><option value="cours">Course</option></select>
          <select name="listingTrimester" className="rounded-xl border border-[#dce5dd] bg-white px-3 py-3"><option value="">No trimester</option><option value="1">Trimester 1</option><option value="2">Trimester 2</option><option value="3">Trimester 3</option></select>
          <input name="listingPrice" type="number" min="0" step="0.01" placeholder="Price (TND)" className="rounded-xl border border-[#dce5dd] px-3 py-3" />
          <label className="text-sm sm:col-span-2">Watermarked preview source images<input multiple accept="image/jpeg,image/png,image/webp" type="file" name="listingPreviews" className="mt-1 block w-full" /></label>
          <label className="text-sm sm:col-span-2">Original PDF<input accept="application/pdf" type="file" name="listingPdf" className="mt-1 block w-full" /></label>
          <button className="rounded-xl bg-[#0e766e] px-4 py-3 font-bold text-white sm:col-span-2">Create concierge store</button>
        </form>
      </section>
    </div>
  </main>;
}
