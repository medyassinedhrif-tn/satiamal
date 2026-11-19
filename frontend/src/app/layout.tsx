import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.FRONTEND_URL ?? "https://yourapp.tn"),
  title: "3alamni.tn | Teacher resources, shared",
  description: "Browse joudhadhet, devoirs, series, and courses shared by Tunisian teachers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
