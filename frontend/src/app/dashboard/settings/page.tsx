"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { DashboardSubpageHeader } from "@/components/DashboardSubpageHeader";
import { useI18n } from "@/i18n";

type Profile = {
  slug: string;
  displayName: string;
  whatsapp: string;
  bio: string | null;
  messengerUrl: string | null;
  whatsappMessageTemplate: string;
  isVerified: boolean;
};

function csrfToken() {
  return document.cookie.split("; ").find((cookie) => cookie.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

export default function StoreSettingsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/seller/profile").then(async (response) => {
      if (response.status === 401) {
        router.push("/login");
        return null;
      }
      if (!response.ok) throw new Error(t.profileLoadError);
      return await response.json() as Profile;
    }).then((result) => { if (active && result) setProfile(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t.profileLoadError); });
    return () => { active = false; };
  }, [router, t.profileLoadError]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());
    try {
      const response = await fetch("/api/seller/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken() },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({})) as Profile & { message?: string };
      if (!response.ok) throw new Error(result.message ?? t.profileLoadError);
      setProfile(result);
      setMessage(t.settingsSaved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.profileLoadError);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <main className="min-h-screen bg-[#f7f8f4] px-5 py-7 text-[#18332f]"><div className="mx-auto max-w-7xl"><DashboardSubpageHeader title={t.profileSettings} />{error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}<p className="mt-8 text-sm text-[#71847d]">{t.loading}</p></div></main>;
  const previewText = profile.whatsappMessageTemplate.replaceAll("{title}", t.listingTitle);

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-5 py-7 text-[#18332f]">
      <div className="mx-auto max-w-7xl">
        <DashboardSubpageHeader title={t.profileSettings} />
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
        {message && <p role="status" className="mt-5 rounded-xl bg-[#e2f2eb] p-4 text-[#0e766e]">{message}</p>}
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <form onSubmit={save} className="rounded-2xl border border-[#e1e8df] bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-extrabold">{t.editStoreProfile}</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-1.5 text-sm font-bold">{t.teacherName}<input required maxLength={100} name="displayName" defaultValue={profile.displayName} className="rounded-xl border border-[#dce5dd] px-3 py-3 font-normal" /></label>
              <label className="grid gap-1.5 text-sm font-bold">{t.whatsapp}<input required name="whatsapp" inputMode="tel" defaultValue={profile.whatsapp} className="rounded-xl border border-[#dce5dd] px-3 py-3 font-normal" /></label>
              <label className="grid gap-1.5 text-sm font-bold">{t.shortBio}<textarea maxLength={300} name="bio" defaultValue={profile.bio ?? ""} rows={3} className="rounded-xl border border-[#dce5dd] px-3 py-3 font-normal" /></label>
              <label className="grid gap-1.5 text-sm font-bold">Messenger URL<input name="messengerUrl" type="url" defaultValue={profile.messengerUrl ?? ""} className="rounded-xl border border-[#dce5dd] px-3 py-3 font-normal" /></label>
              <label className="grid gap-1.5 text-sm font-bold">{t.whatsappGreeting}<textarea maxLength={500} name="whatsappMessageTemplate" defaultValue={profile.whatsappMessageTemplate} rows={3} placeholder="{title}" className="rounded-xl border border-[#dce5dd] px-3 py-3 font-normal" /><span className="text-xs font-normal text-[#71847d]">{t.greetingHint}</span></label>
              <button disabled={saving} className="rounded-xl bg-[#0e766e] px-4 py-3 font-bold text-white disabled:opacity-60">{saving ? t.loading : t.saveSettings}</button>
            </div>
          </form>
          <aside className="space-y-4">
            <section className="rounded-2xl bg-[#123d38] p-6 text-white shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-[#d3e991]">{t.messagePreview}</p>
              <p dir="auto" className="mt-4 whitespace-pre-wrap rounded-xl bg-white/10 p-4 text-sm leading-6">{previewText || t.directPayment}</p>
              <Link href={`/s/${profile.slug}`} className="mt-5 inline-flex rounded-xl bg-[#b5ce59] px-4 py-2.5 text-sm font-bold text-[#18332f]">{t.openStorefront} ↗</Link>
            </section>
            <section className="rounded-2xl border border-[#e1e8df] bg-white p-6 shadow-sm">
              <h2 className="font-extrabold">{t.leakLookup}</h2>
              <p className="mt-2 text-sm leading-6 text-[#71847d]">Each successful PDF delivery embeds buyer-specific forensic information. Upload a suspected PDF or screenshot from the dashboard to inspect a possible leak.</p>
              <Link href="/dashboard#leak-check" className="mt-4 inline-flex rounded-xl border border-[#dce5dd] px-4 py-2 text-sm font-bold text-[#0e766e]">{t.inspectFile} →</Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
