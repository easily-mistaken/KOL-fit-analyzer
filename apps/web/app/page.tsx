import { FileText, Users } from "lucide-react";
import { APP_NAME } from "@kol-fit/shared";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-secondary-foreground">
            Reports
          </h2>
          <span className="font-mono text-xs text-muted-foreground">0</span>
        </div>

        <Card>
          <CardHeader className="items-center text-center">
            <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-elevated text-muted-foreground">
              <FileText className="h-5 w-5" />
            </span>
            <CardTitle className="text-base text-foreground">
              No reports yet
            </CardTitle>
            <CardDescription>
              Create your first KOL fit analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-xs text-muted-foreground">
              Saved analyses will appear here once report generation is wired
              up.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
