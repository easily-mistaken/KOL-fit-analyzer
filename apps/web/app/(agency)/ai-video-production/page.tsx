import { ServicePage } from "@/components/agency/service-page";
import { serviceBySlug } from "@/lib/agency/services";
import { pageMetadata } from "@/lib/agency/seo";

const service = serviceBySlug("ai-video-production");

export const metadata = pageMetadata({
  title: service.metaTitle,
  description: service.metaDescription,
  path: "/ai-video-production",
});

export default function Page() {
  return <ServicePage service={service} />;
}
