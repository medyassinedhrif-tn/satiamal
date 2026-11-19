"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message ?? "Login failed.");
      }
      const result = (await response.json()) as { role: string };
      router.push(result.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f7f8f4] px-5 text-[#18332f]">
    <div className="w-full max-w-md rounded-3xl border border-[#e1e8df] bg-white p-8 shadow-sm">
      <Link href="/" className="text-xl font-black text-[#0e766e]">3alamni.tn</Link>
      <h1 className="mt-7 text-3xl font-black">Welcome back</h1>
      <p className="mt-2 text-[#71847d]">Sign in to manage your teacher store.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-bold">Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-[#dce5dd] px-4 py-3 font-normal" /></label>
        <label className="block text-sm font-bold">Password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-[#dce5dd] px-4 py-3 font-normal" /></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-[#0e766e] px-5 py-3 font-bold text-white disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="mt-5 text-sm text-[#71847d]">New to 3alamni? <Link href="/register" className="font-bold text-[#0e766e]">Create a seller account</Link></p>
    </div>
  </main>;
}
