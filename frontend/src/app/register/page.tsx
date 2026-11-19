"use client";

import Link from "next/link";
import { FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Turnstile } from "@/components/Turnstile";
import { useI18n } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [token, setToken] = useState("");
  const [form, setForm] = useState({ email: "", password: "", displayName: "", slug: "", whatsapp: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const setField = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const onToken = useCallback((value: string) => setToken(value), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, turnstileToken: token }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message ?? "Could not create your account.");
      }
      router.push("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create your account.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f7f8f4] px-5 py-10 text-[#18332f]">
    <div className="w-full max-w-lg rounded-3xl border border-[#e1e8df] bg-white p-8 shadow-sm">
      <div className="flex items-center justify-between"><Link href="/" className="text-xl font-black text-[#0e766e]">3alamni.tn</Link><LanguageSwitcher /></div>
      <h1 className="mt-7 text-3xl font-black">{t.createStore}</h1>
      <p className="mt-2 text-[#71847d]">{t.storeSetup}</p>
      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">{t.displayName}<input required value={form.displayName} onChange={(event) => setField("displayName", event.target.value)} className="mt-1 w-full rounded-xl border border-[#dce5dd] px-4 py-3 font-normal" /></label>
        <label className="text-sm font-bold">{t.storeSlug}<input required pattern="[a-z0-9-]{3,60}" placeholder="prof-amine" value={form.slug} onChange={(event) => setField("slug", event.target.value.toLowerCase())} className="mt-1 w-full rounded-xl border border-[#dce5dd] px-4 py-3 font-normal" /></label>
        <label className="text-sm font-bold sm:col-span-2">{t.whatsapp}<input required inputMode="tel" placeholder="216XXXXXXXX" value={form.whatsapp} onChange={(event) => setField("whatsapp", event.target.value)} className="mt-1 w-full rounded-xl border border-[#dce5dd] px-4 py-3 font-normal" /></label>
        <label className="text-sm font-bold sm:col-span-2">{t.email}<input type="email" required autoComplete="email" value={form.email} onChange={(event) => setField("email", event.target.value)} className="mt-1 w-full rounded-xl border border-[#dce5dd] px-4 py-3 font-normal" /></label>
        <label className="text-sm font-bold sm:col-span-2">{t.passwordHint}<input type="password" required minLength={10} autoComplete="new-password" value={form.password} onChange={(event) => setField("password", event.target.value)} className="mt-1 w-full rounded-xl border border-[#dce5dd] px-4 py-3 font-normal" /></label>
        <div className="sm:col-span-2"><Turnstile onToken={onToken} /></div>
        {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        <button disabled={busy} className="rounded-xl bg-[#0e766e] px-5 py-3 font-bold text-white disabled:opacity-60 sm:col-span-2">{busy ? t.creatingStore : t.createAccount}</button>
      </form>
    </div>
  </main>;
}
