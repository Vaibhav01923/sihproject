import { prisma } from "./db";
import { DOMAINS, ROLE_BENCHMARKS, OFFICES, priorityForGap } from "./domains";
import { getGapAnalysis } from "./recommend";

/** Mean current level (1-5) across all domains, scaled to 0-100. */
export async function getCompetencyIndex(userId: string) {
  const gaps = await getGapAnalysis(userId);
  const mean = gaps.reduce((s, g) => s + g.current, 0) / gaps.length;
  return Math.round((mean / 5) * 100);
}

export async function getHoursCompleted(userId: string) {
  const enrollments = await prisma.enrollment.findMany({ where: { userId }, include: { course: true } });
  const hours = enrollments.reduce((s, e) => s + (e.course.hours * e.progressPct) / 100, 0);
  return Math.round(hours);
}

export async function getKarmayogiCredits(userId: string) {
  return prisma.enrollment.count({ where: { userId, status: "COMPLETED" } });
}

/** Competency index for every user sharing the caller's role, for a simple
 * "how do I compare to peers with the same designation" benchmark. */
export async function getCohortBenchmark(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const peers = await prisma.user.findMany({ where: { role: user.role }, select: { id: true } });

  const indices = await Promise.all(peers.map((p) => getCompetencyIndex(p.id)));
  const sorted = [...indices].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const mine = await getCompetencyIndex(userId);
  const rank = sorted.filter((v) => v <= mine).length;
  const percentile = sorted.length > 1 ? Math.round((rank / sorted.length) * 100) : 100;

  return { mine, peerMedian: median, percentile, cohortSize: peers.length };
}

// --- Admin / office-wide aggregation ---------------------------------------

export async function getAdminTiles() {
  const [staffCount, diagnosedCount, quizCount] = await Promise.all([
    prisma.user.count(),
    prisma.competencyScore.groupBy({ by: ["userId"] }).then((rows) => rows.length),
    prisma.generatedQuestion.count(),
  ]);
  const atBenchmarkCount = await countAtBenchmark();
  const documentCount = await prisma.document.count();

  return {
    staffOnboarded: staffCount,
    diagnosticsTaken: diagnosedCount,
    diagnosticsPct: staffCount ? Math.round((diagnosedCount / staffCount) * 100) : 0,
    atBenchmarkPct: diagnosedCount ? Math.round((atBenchmarkCount / diagnosedCount) * 100) : 0,
    quizzesGenerated: quizCount,
    documentsUploaded: documentCount,
  };
}

async function countAtBenchmark() {
  const domains = await prisma.competencyDomain.findMany();
  const domainCodeById = new Map(domains.map((d) => [d.id, d.code]));
  const users = await prisma.user.findMany({
    select: { id: true, role: true, competencyScore: { where: { isCurrent: true } } },
  });

  let count = 0;
  for (const u of users) {
    if (u.competencyScore.length === 0) continue;
    const benchmark = ROLE_BENCHMARKS[u.role] ?? {};
    const meets = u.competencyScore.every((s) => {
      const code = domainCodeById.get(s.domainId);
      const required = code ? benchmark[code as keyof typeof benchmark] : undefined;
      return required === undefined || s.level >= required;
    });
    if (meets) count++;
  }
  return count;
}

export async function getOfficeReadiness() {
  const domains = await prisma.competencyDomain.findMany();
  const domainCodeById = new Map(domains.map((d) => [d.id, d.code]));

  const results: { name: string; staff: number; pct: number }[] = [];
  for (const office of OFFICES) {
    const users = await prisma.user.findMany({
      where: { office },
      select: { id: true, role: true, competencyScore: { where: { isCurrent: true } } },
    });
    const assessed = users.filter((u) => u.competencyScore.length > 0);
    const meeting = assessed.filter((u) => {
      const benchmark = ROLE_BENCHMARKS[u.role] ?? {};
      return u.competencyScore.every((s) => {
        const code = domainCodeById.get(s.domainId);
        const required = code ? benchmark[code as keyof typeof benchmark] : undefined;
        return required === undefined || s.level >= required;
      });
    });
    results.push({
      name: office,
      staff: users.length,
      pct: assessed.length ? Math.round((meeting.length / assessed.length) * 100) : 0,
    });
  }
  return results;
}

export async function getTopSystemGaps() {
  const domains = await prisma.competencyDomain.findMany({ orderBy: { order: "asc" } });
  const scores = await prisma.competencyScore.findMany({
    where: { isCurrent: true },
    include: { user: true },
  });

  const counts = new Map<string, number>();
  for (const s of scores) {
    const benchmark = ROLE_BENCHMARKS[s.user.role] ?? {};
    const domain = domains.find((d) => d.id === s.domainId);
    if (!domain) continue;
    const required = benchmark[domain.code as keyof typeof benchmark] ?? 3;
    if (priorityForGap(s.level, required) === "CRITICAL") {
      counts.set(domain.name, (counts.get(domain.name) ?? 0) + 1);
    }
  }

  const total = new Set(scores.map((s) => s.userId)).size || 1;
  return Array.from(counts.entries())
    .map(([name, n]) => ({ name, n, pct: Math.round((n / total) * 100) }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
}

/** Projects the competency index assuming every domain touched by the
 * learning path's courses reaches its required level on completion. */
export async function getPathProjection(userId: string, pathCourseIds: string[]) {
  const gaps = await getGapAnalysis(userId);
  const currentIndex = Math.round((gaps.reduce((s, g) => s + g.current, 0) / gaps.length / 5) * 100);

  const domains = await prisma.competencyDomain.findMany();
  const links = await prisma.courseDomain.findMany({ where: { courseId: { in: pathCourseIds } } });
  const touchedDomainIds = new Set(links.map((l) => l.domainId));

  const projectedLevels = gaps.map((g) => (touchedDomainIds.has(g.domainId) ? Math.max(g.current, g.required) : g.current));
  const projectedIndex = Math.round((projectedLevels.reduce((s, l) => s + l, 0) / projectedLevels.length / 5) * 100);

  const gapsClosed = gaps.filter((g) => (g.priority === "CRITICAL" || g.priority === "HIGH") && touchedDomainIds.has(g.domainId)).length;
  const openGaps = gaps.filter((g) => g.priority === "CRITICAL" || g.priority === "HIGH").length;

  return { currentIndex, projectedIndex, gapsClosed, openGaps, domainCount: domains.length };
}

export const DOMAIN_TOTAL = DOMAINS.length;
