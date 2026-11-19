"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { DashboardNav } from "@/components/DashboardNav";

function csrfToken() {
  return document.cookie.split("; ").find((cookie) => cookie.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

export function DashboardSubpageHeader({ title }: { title: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState("");

  async function logout() {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "x-csrf-token": csrfToken(), "content-type": "application/json" },
      body: "{}",
    });
    if (!response.ok) {
      setError("Could not sign out. Please try again.");
      return;
    }
    router.push("/");
  }

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="text-xl font-black text-[#0e766e]">3alamni<span className="text-[#b5ce59]">.tn</span></Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button onClick={() => void logout()} className="text-sm font-bold text-[#0e766e]">{t.signOut}</button>
        </div>
      </header>
      <div className="mt-8">
        <p className="text-sm font-bold uppercase tracking-widest text-[#7b928a]">{t.sellerPortal}</p>
        <h1 className="mt-1 text-3xl font-black">{title}</h1>
      </div>
      <DashboardNav />
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    </>
  );
}
