import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.FRONTEND_URL ?? "https://yourapp.tn"),
  title: "3alamni.tn | موارد الأساتذة",
  description: "تصفح الجذاذات والواجبات والسلاسل والدروس المشتركة من أساتذة تونسيين.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
