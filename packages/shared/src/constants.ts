// Product-level constants shared across web, worker, and packages.

export const APP_NAME = "OverlapX";

// Bumped whenever the FitReport shape changes; persisted with every report
// (Report.reportSchemaVersion in the DB) so old reports remain interpretable.
export const REPORT_SCHEMA_VERSION = 1;
