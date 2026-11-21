import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuidePage } from "@/components/agency/guide-page";
import { GUIDES, guideBySlug } from "@/lib/agency/guides";
import { pageMetadata } from "@/lib/agency/seo";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  if (!guide) return {};
  return pageMetadata({
    title: guide.metaTitle,
    description: guide.metaDescription,
    path: `/guides/${guide.slug}`,
    article: { publishedTime: guide.published, modifiedTime: guide.updated },
  });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();
  return <GuidePage guide={guide} />;
}
