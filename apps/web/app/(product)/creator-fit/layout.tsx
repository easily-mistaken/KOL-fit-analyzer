import type { ReactNode } from "react";
import type { Metadata } from "next";

const DESCRIPTION =
  "We don't measure who follows. We measure who actually listens. Audience-overlap analysis for AI and Web3 brands.";

// Tool-wide metadata, so a shared report or the tool home never previews with
// the agency's description (the root layout's default since Unit 54).
export const metadata: Metadata = {
  title: { default: "Creator Fit", template: "%s · OverlapX Creator Fit" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "OverlapX",
    title: "OverlapX Creator Fit",
    description: DESCRIPTION,
    url: "/creator-fit",
    images: ["/overlapx-og.jpg"],
  },
  twitter: {
    card: "summary",
    title: "OverlapX Creator Fit",
    description: DESCRIPTION,
    images: ["/overlapx-og.jpg"],
  },
};

export default function CreatorFitLayout({ children }: { children: ReactNode }) {
  return children;
}
