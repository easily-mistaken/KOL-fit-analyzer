import { Users } from "lucide-react";
import { APP_NAME } from "@kol-fit/shared";

import { AnalysisForm } from "@/components/analysis-form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <Badge variant="outline" className="text-secondary-foreground">
          <Users className="mr-1.5 h-4 w-4" />
          KOL fit analysis
        </Badge>
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {APP_NAME}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-secondary-foreground">
            We don&apos;t just check what a KOL posts. We check who actually
            listens.
          </p>
        </div>
      </section>

      <Separator />

      <AnalysisForm />
    </div>
  );
}
