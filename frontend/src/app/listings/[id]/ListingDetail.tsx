"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Turnstile } from "@/components/Turnstile";
import { useI18n } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type Listing = {
  id: string; title: string; description: string; cycle: string; grade: string; subject: string;
  trimester: number | null; materialType: string; priceTnd: string; previewImages: string[];
  seller: { sellerProfile: { slug: string; displayName: string; isVerified: boolean; whatsapp: string; messengerUrl: string | null; whatsappMessageTemplate?: string } };
};

export default function ListingPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [reportToken, setReportToken] = useState("");
  const [reportReason, setReportReason] = useState("PIRACY");
  const [reportDetails, setReportDetails] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const onToken = useCallback((value: string) => setToken(value), []);
  const onReportToken = useCallback((value: string) => setReportToken(value), []);

  useEffect(() => {
    fetch(`/api/public/listings/${encodeURIComponent(id)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("This listing is unavailable.");
        setListing((await response.json()) as Listing);
      })
      .catch((reason: Error) => setError(reason.message));
  }, [id]);

  async function redeem(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/public/codes/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, buyerPhone: phone, listingId: id, turnstileToken: token }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message ?? "Could not redeem this code.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "document.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not redeem this code.");
    } finally {
      setBusy(false);
    }
  }

  async function contactSeller() {
    if (!listing) return;
    const template = listing.seller.sellerProfile.whatsappMessageTemplate;
    const text = template ? template.replaceAll("{title}", listing.title) : "";
    const query = text ? `?text=${encodeURIComponent(text)}` : "";
    window.open(`https://wa.me/${listing.seller.sellerProfile.whatsapp}${query}`, "_blank", "noopener,noreferrer");
    void fetch(`/api/public/listings/${listing.id}/click`, { method: "POST" })
      .catch((reason: unknown) => console.error("Could not record listing contact click", reason));
  }

  async function reportListing(event: FormEvent) {
    event.preventDefault();
    setReportMessage("");
    try {
      const response = await fetch(`/api/public/listings/${encodeURIComponent(id)}/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reportReason, details: reportDetails, turnstileToken: reportToken }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Could not submit report.");
      setReportMessage("Thank you. The report has been sent for review.");
      setReportDetails("");
    } catch (reason) {
      setReportMessage(reason instanceof Error ? reason.message : "Could not submit report.");
    }
  }

  if (!listing) return <main className="mx-auto max-w-5xl px-5 py-16">{error || "Loading resource…"}</main>;
  const profile = listing.seller.sellerProfile;
  return (
    <main className="min-h-screen bg-[#f7f8f4] px-5 py-8 text-[#18332f]">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between"><Link href="/" className="font-bold text-[#0e766e]">{t.backToCatalog}</Link><LanguageSwitcher /></div>
        <div className="mt-7 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <section>
            <div className="grid gap-3 sm:grid-cols-2">
              {listing.previewImages.map((src) => <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-white"><Image src={src} alt={`Watermarked preview of ${listing.title}`} fill unoptimized className="object-cover" /></div>)}
            </div>
            <div className="mt-7">
              <p className="text-sm font-bold uppercase tracking-wider text-[#6c867d]">{listing.cycle} · {listing.grade} · {listing.subject}{listing.trimester ? ` · Trimester ${listing.trimester}` : ""}</p>
              <h1 dir="auto" className="mt-2 text-3xl font-black">{listing.title}</h1>
              <p dir="auto" className="mt-4 whitespace-pre-wrap leading-7 text-[#526c63]">{listing.description}</p>
            </div>
          </section>
          <aside className="space-y-5">
            <section className="rounded-2xl border border-[#e1e8df] bg-white p-6 shadow-sm">
              <p className="text-sm text-[#6c867d]">{t.sharedBy}</p>
              <Link dir="auto" href={`/s/${profile.slug}`} className="mt-1 inline-block text-xl font-bold hover:text-[#0e766e]">{profile.displayName} {profile.isVerified && <span className="text-[#0e766e]">✓</span>}</Link>
              <p className="mt-5 text-3xl font-black text-[#0e766e]">{listing.priceTnd} <small className="text-sm">TND</small></p>
              <button onClick={contactSeller} className="mt-5 w-full rounded-xl bg-[#0e766e] px-5 py-3 font-bold text-white hover:bg-[#095c56]">{t.contactWhatsApp}</button>
              <p className="mt-2 text-center text-xs text-[#71847d]">{t.directPayment}</p>
            </section>
            <section className="rounded-2xl border border-[#e1e8df] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-extrabold">{t.haveCode}</h2>
              <p className="mt-1 text-sm text-[#71847d]">{t.codePrompt}</p>
              <form onSubmit={redeem} className="mt-4 space-y-3">
                <input required value={code} onChange={(event) => setCode(event.target.value)} placeholder="EDU-XXXX" className="w-full rounded-xl border border-[#dce5dd] px-4 py-3" />
                <input required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={t.phoneNumber} inputMode="tel" className="w-full rounded-xl border border-[#dce5dd] px-4 py-3" />
                <Turnstile onToken={onToken} />
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                <button disabled={busy} className="w-full rounded-xl bg-[#b5ce59] px-5 py-3 font-bold text-[#18332f] disabled:opacity-60">{busy ? t.preparingDownload : t.downloadPdf}</button>
              </form>
            </section>
            <section className="rounded-2xl border border-[#e1e8df] bg-white p-6 shadow-sm">
              <h2 className="font-extrabold">{t.report}</h2>
              <form onSubmit={reportListing} className="mt-3 space-y-3">
                <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3"><option value="PIRACY">{t.piracy}</option><option value="SCAM">{t.scam}</option><option value="WRONG_INFO">{t.wrongInfo}</option></select>
                <textarea maxLength={400} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder={t.details} className="min-h-20 w-full rounded-xl border border-[#dce5dd] px-3 py-3" />
                <Turnstile onToken={onReportToken} />
                {reportMessage && <p role="status" className="text-sm text-[#526c63]">{reportMessage}</p>}
              </form>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
