import type { Metadata } from "next";
import Storefront from "./Storefront";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const image = `/api/public/og/store/${encodeURIComponent(slug)}`;
  return {
    title: "Teacher storefront | 3alamni.tn",
    openGraph: {
      title: "Teacher storefront | 3alamni.tn",
      description: "Browse learning resources from a Tunisian teacher.",
      type: "profile",
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default function StorePage() {
  return <Storefront />;
}
