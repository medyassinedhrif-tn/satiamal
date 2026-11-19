"use client";

import { useI18n } from "@/i18n";

export function LanguageSwitcher() {
  const { language, setLanguage } = useI18n();
  return (
    <div className="flex items-center rounded-full border border-[#dce5dd] bg-white p-1 text-sm font-bold" aria-label="Language">
      <button type="button" onClick={() => setLanguage("ar")} className={`rounded-full px-3 py-1 ${language === "ar" ? "bg-[#0e766e] text-white" : "text-[#18332f]"}`}>العربية</button>
      <button type="button" onClick={() => setLanguage("fr")} className={`rounded-full px-3 py-1 ${language === "fr" ? "bg-[#0e766e] text-white" : "text-[#18332f]"}`}>FR</button>
    </div>
  );
}
