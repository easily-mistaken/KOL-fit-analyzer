// Regression check for Unit 24 (report delivery / lead capture):
//   - ReportDeliverInputSchema: email/telegram/both accepted, neither rejected,
//     bad email/handle rejected, @ stripped from the handle.
//   - MockMailProvider.send returns success.
//   - renderReportPdf produces a valid non-empty PDF from a minimal report.
//
// Run after `pnpm build`:  node scripts/checks/report-delivery.regression.cjs
// (or `pnpm check:report-delivery`). No network, no DB, no keys.

const {
  ReportDeliverInputSchema,
  FitReportSchema,
  REPORT_SCHEMA_VERSION,
} = require("../../packages/shared/dist/index.js");
const { createMockMailProvider } = require("../../packages/mail/dist/index.js");

let pass = 0,
  fail = 0;
const ck = (n, c) => {
  console.log((c ? "OK   " : "FAIL ") + n);
  c ? pass++ : fail++;
};

(async () => {
  // --- schema ---
  const ok = (v) => ReportDeliverInputSchema.safeParse(v).success;
  ck("email only -> valid", ok({ email: "a@b.com" }));
  ck("telegram only -> valid", ok({ telegramHandle: "@somebody" }));
  ck("both -> valid", ok({ email: "a@b.com", telegramHandle: "somebody" }));
  ck("neither -> invalid", !ok({}));
  ck("empty strings -> invalid (treated as neither)", !ok({ email: "", telegramHandle: "" }));
  ck("bad email -> invalid", !ok({ email: "not-an-email" }));
  ck("short telegram -> invalid", !ok({ telegramHandle: "ab" }));
  const parsed = ReportDeliverInputSchema.safeParse({ telegramHandle: "@Handle_1" });
  ck("telegram @ stripped", parsed.success && parsed.data.telegramHandle === "Handle_1");

  // --- mock mail ---
  const mail = createMockMailProvider();
  const res = await mail.send({ to: "a@b.com", subject: "x", text: "y", attachments: [{ filename: "r.pdf", content: Buffer.from("test") }] });
  ck("mock mail returns an id", Boolean(res.id));

  // --- pdf render (ESM module, dynamic import) ---
  const { renderReportPdf } = await import("../../packages/report-pdf/dist/index.js");
  const minimal = FitReportSchema.parse({
    schemaVersion: REPORT_SCHEMA_VERSION,
    overallScore: { value: 50, confidence: "medium", reasons: ["ok"] },
    verdict: "OKAY",
    confidence: "medium",
    evidence: { sampleSizes: { kolPosts: 100 }, notes: [] },
    keyTakeaways: ["A clean but middling fit."],
  });
  const buf = await renderReportPdf({ fitReport: minimal, scores: null, meta: { orgHandle: "acme", kolHandle: "whale", generatedAt: new Date().toISOString() } });
  ck(`pdf renders a non-empty %PDF buffer (${buf.length} bytes)`, buf.length > 500 && buf.slice(0, 5).toString() === "%PDF-");

  console.log(`\nREPORT DELIVERY REGRESSION: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
