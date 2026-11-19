"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n";

const items = [
  { href: "/dashboard", key: "dashboardOverview" as const, glyph: "◫" },
  { href: "/dashboard/analytics", key: "analytics" as const, glyph: "↗" },
  { href: "/dashboard/resources", key: "resourcesPage" as const, glyph: "▤" },
  { href: "/dashboard/codes", key: "codesPage" as const, glyph: "⌁" },
  { href: "/dashboard/settings", key: "profileSettings" as const, glyph: "⚙" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav aria-label={t.sellerPortal} className="mt-7 flex gap-2 overflow-x-auto rounded-2xl border border-[#e1e8df] bg-white p-2">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
              active ? "bg-[#123d38] text-white shadow-sm" : "text-[#58736a] hover:bg-[#f1f5ef]"
            }`}
          >
            <span aria-hidden="true" className="text-base">{item.glyph}</span>
            {t[item.key]}
          </Link>
        );
      })}
    </nav>
  );
}
