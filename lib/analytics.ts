import { db } from "./db";
import { DOMAINS, ROLE_BENCHMARKS, OFFICES, priorityForGap } from "./domains";
import { getGapAnalysis, type DomainGap } from "./recommend";
import type { CompetencyDomainRow } from "./schema";

/** Mean current level (1-5) across all domains, scaled to 0-100. Pure/sync -
 * pass in gaps you've already fetched instead of calling getCompetencyIndex,
 * which re-fetches them, if you already have them in hand. */
export function indexFromGaps(gaps: DomainGap[]) {
  const mean = gaps.reduce((s, g) => s + g.current, 0) / gaps.length;
  return Math.round((mean / 5) * 100);
}

export async function getCompetencyIndex(userId: string) {
  return indexFromGaps(await getGapAnalysis(userId));
}

export async function getHoursCompleted(userId: string) {
  const { data } = await db.from("Enrollment").select("progressPct, course:Course(hours)").eq("userId", userId);
  const enrollments = (data ?? []) as unknown as { progressPct: number; course: { hours: number } | null }[];
  const hours = enrollments.reduce((s, e) => s + ((e.course?.hours ?? 0) * e.progressPct) / 100, 0);
  return Math.round(hours);
}

export async function getKarmayogiCredits(userId: string) {
  const { count } = await db
    .from("Enrollment")
    .select("*", { count: "exact", head: true })
    .eq("userId", userId)
    .eq("status", "COMPLETED");
  return count ?? 0;
}

/** Competency index for every user sharing the caller's role, for a simple
 * "how do I compare to peers with the same designation" benchmark.
 *
 * Batched into a fixed 3 queries regardless of cohort size - this used to
 * call getCompetencyIndex() (3 queries each) per peer via Promise.all,
 * which meant a single Overview page load could fire 60+ concurrent
 * queries for a role with ~20 peers. SQLite never surfaced that as a
 * problem; a real pooled Postgres connection limit does immediately. */
export async function getCohortBenchmark(userId: string) {
  const { data: userData, error: userError } = await db.from("User").select("*").eq("id", userId).single();
  if (userError) throw new Error(userError.message);
  const user = userData as { id: string; role: string };

  const { data: peersData } = await db.from("User").select("id").eq("role", user.role);
  const peerIds = (peersData ?? []).map((p) => p.id as string);

  const { data: scoresData } = await db
    .from("CompetencyScore")
    .select("userId, level")
    .in("userId", peerIds)
    .eq("isCurrent", true);
  const scores = (scoresData ?? []) as { userId: string; level: number }[];

  const levelsByUser = new Map<string, number[]>();
  for (const s of scores) {
    const arr = levelsByUser.get(s.userId) ?? [];
    arr.push(s.level);
    levelsByUser.set(s.userId, arr);
  }

  // Mirrors getGapAnalysis's floor: a domain with no score yet counts as level 1.
  const indexFor = (id: string) => {
    const levels = levelsByUser.get(id) ?? [];
    const total = levels.reduce((s, l) => s + l, 0) + (DOMAINS.length - levels.length) * 1;
    return Math.round((total / DOMAINS.length / 5) * 100);
  };

  const indices = peerIds.map(indexFor);
  const sorted = [...indices].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const mine = indexFor(userId);
  const rank = sorted.filter((v) => v <= mine).length;
  const percentile = sorted.length > 1 ? Math.round((rank / sorted.length) * 100) : 100;

  return { mine, peerMedian: median, percentile, cohortSize: peerIds.length };
}

// --- Admin / office-wide aggregation ---------------------------------------

export async function getAdminTiles() {
  const [{ count: staffCount }, { data: scoreRows }, { count: quizCount }, { count: documentCount }] = await Promise.all([
    db.from("User").select("*", { count: "exact", head: true }),
    db.from("CompetencyScore").select("userId"),
    db.from("GeneratedQuestion").select("*", { count: "exact", head: true }),
    db.from("Document").select("*", { count: "exact", head: true }),
  ]);
  const diagnosedCount = new Set((scoreRows ?? []).map((r) => r.userId as string)).size;
  const atBenchmarkCount = await countAtBenchmark();

  return {
    staffOnboarded: staffCount ?? 0,
    diagnosticsTaken: diagnosedCount,
    diagnosticsPct: staffCount ? Math.round((diagnosedCount / staffCount) * 100) : 0,
    atBenchmarkPct: diagnosedCount ? Math.round((atBenchmarkCount / diagnosedCount) * 100) : 0,
    quizzesGenerated: quizCount ?? 0,
    documentsUploaded: documentCount ?? 0,
  };
}

/** True if every one of this user's current scores meets (or has no
 * benchmark defined for) their role's requirement. */
function meetsBenchmark(
  role: string,
  userScores: { domainId: string; level: number }[],
  domainCodeById: Map<string, string>
): boolean {
  const benchmark = ROLE_BENCHMARKS[role] ?? {};
  return userScores.every((s) => {
    const code = domainCodeById.get(s.domainId);
    const required = code ? benchmark[code as keyof typeof benchmark] : undefined;
    return required === undefined || s.level >= required;
  });
}

async function countAtBenchmark() {
  const { data: domainsData } = await db.from("CompetencyDomain").select("*");
  const domainCodeById = new Map(((domainsData ?? []) as CompetencyDomainRow[]).map((d) => [d.id, d.code]));

  const { data: usersData } = await db.from("User").select("id, role");
  const users = (usersData ?? []) as { id: string; role: string }[];

  const { data: scoresData } = await db.from("CompetencyScore").select("userId, domainId, level").eq("isCurrent", true);
  const scoresByUser = new Map<string, { domainId: string; level: number }[]>();
  for (const s of (scoresData ?? []) as { userId: string; domainId: string; level: number }[]) {
    const arr = scoresByUser.get(s.userId) ?? [];
    arr.push(s);
    scoresByUser.set(s.userId, arr);
  }

  let count = 0;
  for (const u of users) {
    const userScores = scoresByUser.get(u.id);
    if (!userScores || userScores.length === 0) continue;
    if (meetsBenchmark(u.role, userScores, domainCodeById)) count++;
  }
  return count;
}

export async function getOfficeReadiness() {
  const { data: domainsData } = await db.from("CompetencyDomain").select("*");
  const domainCodeById = new Map(((domainsData ?? []) as CompetencyDomainRow[]).map((d) => [d.id, d.code]));

  const { data: usersData } = await db.from("User").select("id, role, office").in("office", [...OFFICES]);
  const users = (usersData ?? []) as { id: string; role: string; office: string }[];

  const { data: scoresData } = await db.from("CompetencyScore").select("userId, domainId, level").eq("isCurrent", true);
  const scoresByUser = new Map<string, { domainId: string; level: number }[]>();
  for (const s of (scoresData ?? []) as { userId: string; domainId: string; level: number }[]) {
    const arr = scoresByUser.get(s.userId) ?? [];
    arr.push(s);
    scoresByUser.set(s.userId, arr);
  }

  return OFFICES.map((office) => {
    const officeUsers = users.filter((u) => u.office === office);
    let assessedCount = 0;
    let meetingCount = 0;
    for (const u of officeUsers) {
      const userScores = scoresByUser.get(u.id);
      if (!userScores || userScores.length === 0) continue;
      assessedCount++;
      if (meetsBenchmark(u.role, userScores, domainCodeById)) meetingCount++;
    }
    return { name: office, staff: officeUsers.length, pct: assessedCount ? Math.round((meetingCount / assessedCount) * 100) : 0 };
  });
}

export async function getTopSystemGaps() {
  const { data: domainsData } = await db.from("CompetencyDomain").select("*").order("order", { ascending: true });
  const domains = (domainsData ?? []) as CompetencyDomainRow[];

  const { data: scoresData } = await db
    .from("CompetencyScore")
    .select("userId, domainId, level, user:User(role)")
    .eq("isCurrent", true);
  const scores = (scoresData ?? []) as unknown as { userId: string; domainId: string; level: number; user: { role: string } | null }[];

  const counts = new Map<string, number>();
  for (const s of scores) {
    if (!s.user) continue;
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

  const { data: domainsData } = await db.from("CompetencyDomain").select("*");
  const domains = domainsData ?? [];
  const { data: linksData } = await db.from("CourseDomain").select("domainId").in("courseId", pathCourseIds);
  const touchedDomainIds = new Set((linksData ?? []).map((l) => l.domainId as string));

  const projectedLevels = gaps.map((g) => (touchedDomainIds.has(g.domainId) ? Math.max(g.current, g.required) : g.current));
  const projectedIndex = Math.round((projectedLevels.reduce((s, l) => s + l, 0) / projectedLevels.length / 5) * 100);

  const gapsClosed = gaps.filter((g) => (g.priority === "CRITICAL" || g.priority === "HIGH") && touchedDomainIds.has(g.domainId)).length;
  const openGaps = gaps.filter((g) => g.priority === "CRITICAL" || g.priority === "HIGH").length;

  return { currentIndex, projectedIndex, gapsClosed, openGaps, domainCount: domains.length };
}

export const DOMAIN_TOTAL = DOMAINS.length;
