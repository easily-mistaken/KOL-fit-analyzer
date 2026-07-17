// Product-level constants shared across web, worker, and packages.

export const APP_NAME = "OverlapX";

export const PRODUCT_POSITIONING =
  "We don't measure who follows. We measure who actually listens.";

// Bumped whenever the FitReport shape changes; persisted with every report
// (Report.reportSchemaVersion in the DB) so old reports remain interpretable.
export const REPORT_SCHEMA_VERSION = 1;
