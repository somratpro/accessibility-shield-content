import type { AntiAIAuditResult } from "./ai/content-optimizer";

/** Concrete, fixable problems the cleanup pass removes. Empty means the post is fine. */
export function postIssues(audit: AntiAIAuditResult | null | undefined): string[] {
  const issues: string[] = [];
  const dashes = audit?.emDashCount ?? 0;
  const phrases = audit?.aiClicheCount ?? 0;
  const burstiness = audit?.burstinessScore ?? 100;
  if (dashes) issues.push(`${dashes} em-dash${dashes === 1 ? "" : "es"}`);
  if (phrases) issues.push(`${phrases} AI-sounding word${phrases === 1 ? "" : "s"}`);
  // Uniform sentence length is the strongest signal AI detectors use.
  if (burstiness < 70) issues.push("uniform sentence length");
  return issues;
}
