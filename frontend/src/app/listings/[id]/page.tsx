import type { Metadata } from "next";
import ListingDetail from "./ListingDetail";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const image = `/api/public/og/listing/${encodeURIComponent(id)}`;
  return {
    title: "Teacher resource | 3alamni.tn",
    openGraph: {
      title: "Teacher resource | 3alamni.tn",
      description: "Discover a classroom resource shared by a Tunisian teacher.",
      type: "article",
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default function ListingPage() {
  return <ListingDetail />;
}
