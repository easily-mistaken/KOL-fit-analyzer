import { ServicePage } from "@/components/agency/service-page";
import { serviceBySlug } from "@/lib/agency/services";
import { pageMetadata } from "@/lib/agency/seo";

const service = serviceBySlug("launch-videos");

export const metadata = pageMetadata({
  title: service.metaTitle,
  description: service.metaDescription,
  path: "/launch-videos",
});

export default function Page() {
  return <ServicePage service={service} />;
}
