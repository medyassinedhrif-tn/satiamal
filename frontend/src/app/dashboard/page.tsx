"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type Dashboard = { codeBalance: number; contactClicks: number; activeListings: number; totalListings: number; codesGenerated: number };
type Listing = { id: string; title: string; grade: string; subject: string; priceTnd: string; status: string };
type Code = { id: string; code: string; buyerPhone: string; downloadCount: number; expiresAt: string | null; isRevoked: boolean };
type FacebookPack = { listingId: string; text: string; previewImages: string[] };

function csrfToken() {
  return document.cookie.split("; ").find((cookie) => cookie.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

export default function DashboardPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [stats, setStats] = useState<Dashboard | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [facebookPack, setFacebookPack] = useState<FacebookPack | null>(null);
  const [lookupPhone, setLookupPhone] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [codeForm, setCodeForm] = useState({ listingId: "", buyerPhone: "", buyerNote: "" });

  const load = useCallback(async () => {
    const [statsResponse, listingResponse, codesResponse] = await Promise.all([
      fetch("/api/seller/dashboard"), fetch("/api/seller/listings"), fetch("/api/seller/codes"),
    ]);
    if ([statsResponse, listingResponse, codesResponse].some((response) => response.status === 401)) {
      router.push("/login");
      return;
    }
    if (!statsResponse.ok || !listingResponse.ok || !codesResponse.ok) throw new Error("Could not load your seller dashboard.");
    setStats((await statsResponse.json()) as Dashboard);
    const listingData = (await listingResponse.json()) as Listing[];
    setListings(listingData);
    setCodes((await codesResponse.json()) as Code[]);
    setCodeForm((current) => ({ ...current, listingId: current.listingId || listingData[0]?.id || "" }));
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((reason: Error) => setError(reason.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function request(url: string, method: string, body: BodyInit, contentType?: string) {
    const headers: Record<string, string> = { "x-csrf-token": csrfToken() };
    if (contentType) headers["content-type"] = contentType;
    const response = await fetch(url, { method, headers, ...(method === "GET" ? {} : { body }) });
    const result = await response.json().catch(() => ({})) as { message?: string };
    if (!response.ok) throw new Error(result.message ?? "Request failed.");
    return result;
  }

  async function createCode(event: FormEvent) {
    event.preventDefault();
    try {
      await request("/api/seller/codes", "POST", JSON.stringify(codeForm), "application/json");
      setMessage("Download code created. Share it only with the buyer.");
      setError("");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create code."); }
  }

  async function createListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!form.get("trimester")) form.delete("trimester");
    try {
      await request("/api/seller/listings", "POST", form);
      setMessage("Listing published.");
      setError("");
      event.currentTarget.reset();
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not publish listing."); }
  }

  async function generatePack(id: string) {
    try {
      const response = await request(`/api/seller/listings/${id}/fb-pack`, "GET", "");
      const pack = response as { text: string; previewImages: string[] };
      setFacebookPack({ ...pack, listingId: id });
      try {
        await navigator.clipboard.writeText(pack.text);
        setMessage("Facebook post copied. Download the watermarked previews below.");
      } catch {
        setMessage("Facebook post ready. Copy the text below and download the watermarked previews.");
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not prepare Facebook post."); }
  }

  async function editListing(item: Listing) {
    const title = window.prompt("Update listing title", item.title);
    if (title === null) return;
    const priceTnd = window.prompt("Update price in TND", item.priceTnd);
    if (priceTnd === null) return;
    try {
      await request(`/api/seller/listings/${item.id}`, "PATCH", JSON.stringify({ title, priceTnd }), "application/json");
      setMessage("Listing updated.");
      setError("");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update listing."); }
  }

  async function deleteListing(item: Listing) {
    if (!window.confirm(`Delete "${item.title}" and its stored files?`)) return;
    try {
      await request(`/api/seller/listings/${item.id}`, "DELETE", "{}", "application/json");
      setMessage("Listing deleted.");
      setError("");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete listing."); }
  }

  async function findCodes(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await request(`/api/seller/codes?phone=${encodeURIComponent(lookupPhone)}`, "GET", "");
      setCodes(result as Code[]);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not search codes."); }
  }

  async function revokeCode(id: string) {
    try {
      await request(`/api/seller/codes/${id}/revoke`, "PATCH", "{}", "application/json");
      setMessage("Download code revoked.");
      setError("");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not revoke code."); }
  }

  async function uploadLeak(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget);
    try {
      const result = await request("/api/seller/leak-check", "POST", file) as { detected?: boolean; buyerPhone?: string; verified?: boolean; enhancedImageBase64?: string };
      setMessage(result.detected ? `Leak match: ${result.buyerPhone} · signature ${result.verified ? "verified" : "not verified"}` : result.enhancedImageBase64 ? "Screenshot enhanced and ready to inspect." : "No watermark match found.");
      if (result.enhancedImageBase64) window.open(`data:image/webp;base64,${result.enhancedImageBase64}`, "_blank", "noopener,noreferrer");
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not inspect file."); }
  }

  async function createTopup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const body: Record<string, FormDataEntryValue | number> = {
      ...data,
      ...(data.topupType === "CODE_PACK" ? { packCodes: Number(data.packCodes) } : { boostDays: Number(data.boostDays) }),
    };
    if (data.topupType === "CODE_PACK") {
      delete body.listingId;
      delete body.boostDays;
    } else {
      delete body.packCodes;
    }
    try {
      await request("/api/seller/topups", "POST", JSON.stringify(body), "application/json");
      setMessage("Top-up request sent for admin review.");
      setError("");
      event.currentTarget.reset();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not submit top-up."); }
  }

  async function logout() {
    try {
      await request("/api/auth/logout", "POST", "{}", "application/json");
      router.push("/");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not sign out."); }
  }

  return <main className="min-h-screen bg-[#f7f8f4] px-5 py-7 text-[#18332f]">
    <div className="mx-auto max-w-7xl">
      <header className="flex items-center justify-between"><Link href="/" className="text-xl font-black text-[#0e766e]">3alamni.tn</Link><div className="flex items-center gap-3"><LanguageSwitcher /><button onClick={logout} className="text-sm font-bold text-[#0e766e]">{t.signOut}</button></div></header>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-widest text-[#7b928a]">{t.sellerPortal}</p><h1 className="text-3xl font-black">{t.yourStore}</h1></div></div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-emerald-900">{message}</p>}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        [t.codesAvailable, stats?.codeBalance], [t.contactClicks, stats?.contactClicks], [t.activeListings, stats?.activeListings], [t.codesGenerated, stats?.codesGenerated],
      ].map(([label, value]) => <div key={label} className="rounded-2xl border border-[#e1e8df] bg-white p-5"><p className="text-sm text-[#71847d]">{label}</p><p className="mt-2 text-3xl font-black">{value ?? "—"}</p></div>)}</section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#e1e8df] bg-white p-6">
          <h2 className="text-xl font-extrabold">{t.publishResource}</h2>
          <form onSubmit={createListing} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input required name="title" placeholder={t.title} className="rounded-xl border border-[#dce5dd] px-3 py-3 sm:col-span-2" />
            <textarea required name="description" placeholder={t.description} className="min-h-24 rounded-xl border border-[#dce5dd] px-3 py-3 sm:col-span-2" />
            <select required name="cycle" className="rounded-xl border border-[#dce5dd] bg-white px-3 py-3"><option value="">{t.level}</option><option value="primaire">{t.primaire}</option><option value="college">{t.college}</option><option value="lycee">{t.lycee}</option></select>
            <input required name="grade" placeholder={t.gradeExample} className="rounded-xl border border-[#dce5dd] px-3 py-3" />
            <input required name="subject" placeholder={t.subjectPlaceholder} className="rounded-xl border border-[#dce5dd] px-3 py-3" />
            <select required name="materialType" className="rounded-xl border border-[#dce5dd] bg-white px-3 py-3">{["joudhadha", "devoir", "serie", "cours"].map((item) => <option key={item} value={item}>{item === "joudhadha" ? t.joudhadha : item === "devoir" ? t.devoir : item === "serie" ? t.serie : t.cours}</option>)}</select>
            <select name="trimester" className="rounded-xl border border-[#dce5dd] bg-white px-3 py-3"><option value="">— {t.noTrimester}</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select>
            <input required type="number" min="0" step="0.01" name="priceTnd" placeholder={t.price} className="rounded-xl border border-[#dce5dd] px-3 py-3" />
            <label className="text-sm sm:col-span-2">{t.previewHint}<input required multiple accept="image/jpeg,image/png,image/webp" type="file" name="previews" className="mt-1 block w-full text-sm" /></label>
            <label className="text-sm sm:col-span-2">{t.fullDocument}<input required accept="application/pdf" type="file" name="pdf" className="mt-1 block w-full text-sm" /></label>
            <button className="rounded-xl bg-[#0e766e] px-4 py-3 font-bold text-white sm:col-span-2">{t.publishListing}</button>
          </form>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-[#e1e8df] bg-white p-6">
            <h2 className="text-xl font-extrabold">{t.createCode}</h2>
            <form onSubmit={createCode} className="mt-4 space-y-3">
              <select required value={codeForm.listingId} onChange={(event) => setCodeForm({ ...codeForm, listingId: event.target.value })} className="w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3"><option value="">{t.chooseListing}</option>{listings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
              <input required inputMode="tel" value={codeForm.buyerPhone} onChange={(event) => setCodeForm({ ...codeForm, buyerPhone: event.target.value })} placeholder={t.buyerPhonePlaceholder} className="w-full rounded-xl border border-[#dce5dd] px-3 py-3" />
              <input value={codeForm.buyerNote} onChange={(event) => setCodeForm({ ...codeForm, buyerNote: event.target.value })} placeholder={t.buyerNotePlaceholder} className="w-full rounded-xl border border-[#dce5dd] px-3 py-3" />
              <button className="w-full rounded-xl bg-[#b5ce59] px-4 py-3 font-bold">{t.generateCode}</button>
            </form>
            <form onSubmit={findCodes} className="mt-5 flex gap-2"><input value={lookupPhone} onChange={(event) => setLookupPhone(event.target.value)} placeholder={t.searchBuyerPhone} inputMode="tel" className="min-w-0 flex-1 rounded-xl border border-[#dce5dd] px-3 py-2 text-sm" /><button className="rounded-xl border border-[#dce5dd] px-3 text-sm font-bold">{t.searchAction}</button></form>
            <div className="mt-3 space-y-2">{codes.slice(0, 5).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f6f8f3] p-3 text-sm"><span className="font-bold">{item.code} · {item.buyerPhone} · {item.downloadCount}/3</span>{!item.isRevoked && <button onClick={() => void revokeCode(item.id)} className="font-bold text-red-700">{t.revokeAction}</button>}</div>)}</div>
          </div>

          <div className="rounded-2xl border border-[#e1e8df] bg-white p-6">
            <h2 className="text-xl font-extrabold">{t.yourListings}</h2>
            <div className="mt-3 space-y-2">{listings.map((item) => <div key={item.id} className="rounded-xl bg-[#f6f8f3] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p dir="auto" className="font-bold">{item.title}</p><p className="text-xs text-[#71847d]">{item.grade} · {item.subject} · {item.status === "ACTIVE" ? t.activeStatus : t.hiddenStatus}</p></div><div className="flex gap-2"><button onClick={() => void editListing(item)} className="rounded-lg border border-[#cbd8ce] px-3 py-2 text-sm font-bold">{t.editAction}</button><button onClick={() => void deleteListing(item)} className="rounded-lg border border-[#cbd8ce] px-3 py-2 text-sm font-bold text-red-700">{t.deleteAction}</button><button onClick={() => void generatePack(item.id)} className="rounded-lg border border-[#cbd8ce] px-3 py-2 text-sm font-bold">{t.facebookPack}</button></div></div>{facebookPack?.listingId === item.id && <div className="mt-3 border-t border-[#e1e8df] pt-3"><p dir="auto" className="whitespace-pre-wrap text-sm">{facebookPack.text}</p><div className="mt-3 flex flex-wrap gap-3">{facebookPack.previewImages.map((url, index) => <a key={url} href={url} download target="_blank" rel="noreferrer" className="text-sm font-bold text-[#0e766e]">{t.downloadPreview} {index + 1}</a>)}</div></div>}</div>)}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e1e8df] bg-white p-6">
          <h2 className="text-xl font-extrabold">{t.leakLookup}</h2>
          <form onSubmit={uploadLeak} className="mt-4 flex flex-wrap gap-3">
            <input required type="file" name="file" accept="application/pdf,image/*" className="min-w-0 flex-1 text-sm" />
            <button className="rounded-xl bg-[#0e766e] px-4 py-2 font-bold text-white">{t.inspectLeak}</button>
          </form>
        </section>

        <section className="rounded-2xl border border-[#e1e8df] bg-white p-6">
          <h2 className="text-xl font-extrabold">{t.codePacks}</h2>
          <form onSubmit={createTopup} className="mt-4 grid gap-3 sm:grid-cols-2">
            <select name="topupType" className="rounded-xl border border-[#dce5dd] bg-white px-3 py-3"><option value="CODE_PACK">{t.codePack}</option><option value="BOOST">{t.listingBoost}</option></select>
            <select name="packCodes" className="rounded-xl border border-[#dce5dd] bg-white px-3 py-3"><option value="15">15 {t.codes}</option><option value="50">50 {t.codes}</option><option value="100">100 {t.codes}</option></select>
            <select name="listingId" className="rounded-xl border border-[#dce5dd] bg-white px-3 py-3"><option value="">— {t.listingOptional}</option>{listings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
            <select name="boostDays" className="rounded-xl border border-[#dce5dd] bg-white px-3 py-3"><option value="7">7 {t.days}</option><option value="14">14 {t.days}</option><option value="30">30 {t.days}</option></select>
            <input required name="amountTnd" type="number" min="0" step="0.01" placeholder={t.amount} className="rounded-xl border border-[#dce5dd] px-3 py-3" />
            <select name="paymentMethod" className="rounded-xl border border-[#dce5dd] bg-white px-3 py-3"><option>D17</option><option>FLOUCI</option><option>RIB</option></select>
            <input required name="receiptRef" placeholder={t.transferReference} className="rounded-xl border border-[#dce5dd] px-3 py-3 sm:col-span-2" />
            <button className="rounded-xl bg-[#b5ce59] px-4 py-3 font-bold sm:col-span-2">{t.submitForReview}</button>
          </form>
        </section>
      </div>
    </div>
  </main>;
}
