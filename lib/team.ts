import { db } from "./db";
import { ROLE_BENCHMARKS, priorityForGap } from "./domains";
import type { CompetencyDomainRow, AssessmentAttemptRow } from "./schema";

export type DirectReport = {
  id: string;
  name: string;
  employeeId: string;
  role: string;
  office: string;
  latestAttempt: Pick<AssessmentAttemptRow, "id" | "status" | "completedAt" | "endorsedByUserId" | "endorsedAt"> | null;
  competencyIndex: number; // 0-100, same unassessed-domain-floors-at-1 convention as getGapAnalysis
  criticalGapCount: number;
};

/**
 * Everyone reporting to this officer, plus a summary of their diagnostic
 * status and competency standing - batched into a fixed 4 queries
 * regardless of team size, following the same pattern getCohortBenchmark
 * uses (fetch the group, fetch their data in one .in() query each, reduce
 * in JS) rather than looping a query per report.
 */
export async function getDirectReports(officerId: string): Promise<DirectReport[]> {
  const [{ data: reportsData }, { data: domainsData }] = await Promise.all([
    db.from("User").select("id, name, employeeId, role, office").eq("reportingOfficerId", officerId),
    db.from("CompetencyDomain").select("*"),
  ]);
  const reports = reportsData ?? [];
  const domains = (domainsData ?? []) as CompetencyDomainRow[];
  if (reports.length === 0) return [];

  const reportIds = reports.map((r) => r.id as string);

  const [{ data: attemptsData }, { data: scoresData }] = await Promise.all([
    db.from("AssessmentAttempt").select("*").in("userId", reportIds).order("startedAt", { ascending: false }),
    db.from("CompetencyScore").select("userId, domainId, level").in("userId", reportIds).eq("isCurrent", true),
  ]);
  const attempts = (attemptsData ?? []) as AssessmentAttemptRow[];
  const scores = (scoresData ?? []) as { userId: string; domainId: string; level: number }[];

  // attempts is ordered startedAt desc, so the first row seen per userId is the latest.
  const latestAttemptByUser = new Map<string, AssessmentAttemptRow>();
  for (const a of attempts) {
    if (!latestAttemptByUser.has(a.userId)) latestAttemptByUser.set(a.userId, a);
  }

  const scoresByUser = new Map<string, { domainId: string; level: number }[]>();
  for (const s of scores) {
    const arr = scoresByUser.get(s.userId) ?? [];
    arr.push(s);
    scoresByUser.set(s.userId, arr);
  }

  return reports.map((r) => {
    const benchmark = ROLE_BENCHMARKS[r.role as string] ?? {};
    const scoreByDomain = new Map((scoresByUser.get(r.id as string) ?? []).map((s) => [s.domainId, s.level]));

    let levelSum = 0;
    let criticalGapCount = 0;
    for (const d of domains) {
      const current = scoreByDomain.get(d.id) ?? 1;
      const required = benchmark[d.code as keyof typeof benchmark] ?? 3;
      levelSum += current;
      if (priorityForGap(current, required) === "CRITICAL") criticalGapCount++;
    }

    return {
      id: r.id as string,
      name: r.name as string,
      employeeId: r.employeeId as string,
      role: r.role as string,
      office: r.office as string,
      latestAttempt: latestAttemptByUser.get(r.id as string) ?? null,
      competencyIndex: domains.length ? Math.round((levelSum / domains.length / 5) * 100) : 0,
      criticalGapCount,
    };
  });
}
