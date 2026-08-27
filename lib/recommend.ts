import { prisma } from "./db";
import { DOMAINS, ROLE_BENCHMARKS, priorityForGap } from "./domains";

export type DomainGap = {
  domainId: string;
  code: string;
  name: string;
  current: number;
  required: number;
  gap: number;
  priority: "CRITICAL" | "HIGH" | "MODERATE" | "MET";
};

/** Current level per domain vs. the user's role benchmark. Domains the user
 * hasn't been assessed on yet default to level 1 (unassessed floor). */
export async function getGapAnalysis(userId: string): Promise<DomainGap[]> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const domains = await prisma.competencyDomain.findMany({ orderBy: { order: "asc" } });
  const scores = await prisma.competencyScore.findMany({ where: { userId, isCurrent: true } });
  const scoreByDomain = new Map(scores.map((s) => [s.domainId, s.level]));
  const benchmark = ROLE_BENCHMARKS[user.role] ?? {};

  return domains.map((d) => {
    const current = scoreByDomain.get(d.id) ?? 1;
    const required = benchmark[d.code as keyof typeof benchmark] ?? 3;
    const gap = required - current;
    return {
      domainId: d.id,
      code: d.code,
      name: d.name,
      current,
      required,
      gap,
      priority: priorityForGap(current, required),
    };
  });
}

const PRIORITY_WEIGHT: Record<string, number> = { CRITICAL: 3, HIGH: 2, MODERATE: 1, MET: 0 };

export type RankedCourse = {
  id: string;
  title: string;
  description: string;
  source: string;
  hours: number;
  mandatory: boolean;
  matchPct: number;
  primaryDomainCode: string;
};

/** Score every course by gap-severity x relevance-weight, summed across the
 * domains it covers, then rank. This is the recommendation engine. */
export async function getRankedCourses(userId: string): Promise<RankedCourse[]> {
  const gaps = await getGapAnalysis(userId);
  const gapByDomainId = new Map(gaps.map((g) => [g.domainId, g]));

  const courses = await prisma.course.findMany({
    include: { domains: { include: { domain: true }, orderBy: { weight: "desc" } } },
  });

  const maxPossible = PRIORITY_WEIGHT.CRITICAL * 1; // per unit weight, for normalisation

  return courses
    .map((c) => {
      let score = 0;
      let totalWeight = 0;
      for (const link of c.domains) {
        const g = gapByDomainId.get(link.domainId);
        const severity = g ? PRIORITY_WEIGHT[g.priority] : 0;
        score += severity * link.weight;
        totalWeight += link.weight;
      }
      const normalised = totalWeight > 0 ? score / (totalWeight * maxPossible) : 0;
      const matchPct = Math.round(Math.min(1, Math.max(0.12, normalised)) * 100);
      const primary = c.domains[0]?.domain;
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        source: c.source,
        hours: c.hours,
        mandatory: c.mandatory,
        matchPct,
        primaryDomainCode: primary?.code ?? "",
      };
    })
    .sort((a, b) => b.matchPct - a.matchPct);
}

/** Greedy set-cover: repeatedly take the highest-match course that still
 * covers an unclosed CRITICAL/HIGH gap, until every such gap is covered or
 * the pool is exhausted, then lay the picks out sequentially by week using
 * an assumed 3 study-hours/week pace. */
export async function generateLearningPath(userId: string, attemptId?: string) {
  const gaps = await getGapAnalysis(userId);
  const openGapDomainIds = new Set(
    gaps.filter((g) => g.priority === "CRITICAL" || g.priority === "HIGH").map((g) => g.domainId)
  );

  const ranked = await getRankedCourses(userId);
  const courses = await prisma.course.findMany({ include: { domains: true } });
  const courseById = new Map(courses.map((c) => [c.id, c]));

  const picks: { courseId: string; rationale: string }[] = [];
  const covered = new Set<string>();
  for (const rc of ranked) {
    if (openGapDomainIds.size > 0 && covered.size >= openGapDomainIds.size) break;
    const course = courseById.get(rc.id);
    if (!course) continue;
    const closesDomainIds = course.domains.map((d) => d.domainId).filter((id) => openGapDomainIds.has(id));
    const isNewCoverage = closesDomainIds.some((id) => !covered.has(id));
    if (!isNewCoverage && picks.length >= 3) continue; // keep going a little past full coverage for depth, cap noise
    if (picks.length >= 6) break;

    const gapNames = gaps
      .filter((g) => closesDomainIds.includes(g.domainId))
      .map((g) => g.name);
    const rationale =
      gapNames.length > 0
        ? `Closes ${gapNames.join(" and ")}, currently your ${gaps.find((g) => g.domainId === closesDomainIds[0])?.priority.toLowerCase()} gap.`
        : `Consolidation and refresher aligned to ${rc.primaryDomainCode}.`;
    picks.push({ courseId: rc.id, rationale });
    closesDomainIds.forEach((id) => covered.add(id));
  }

  // Always include at least the top 3 ranked courses even with no open gaps.
  if (picks.length === 0) {
    for (const rc of ranked.slice(0, 3)) {
      picks.push({ courseId: rc.id, rationale: `High relevance to your current role profile.` });
    }
  }

  const STUDY_HOURS_PER_WEEK = 4;
  let weekCursor = 1;
  const items: { courseId: string; orderIndex: number; weekStart: number; weekEnd: number; rationale: string }[] = [];
  picks.forEach((p, i) => {
    const course = courseById.get(p.courseId)!;
    const weeks = Math.max(1, Math.ceil(course.hours / STUDY_HOURS_PER_WEEK));
    const weekStart = weekCursor;
    const weekEnd = weekCursor + weeks - 1;
    weekCursor = weekEnd + 1;
    items.push({ courseId: p.courseId, orderIndex: i, weekStart, weekEnd, rationale: p.rationale });
  });

  const hoursTotal = picks.reduce((sum, p) => sum + (courseById.get(p.courseId)?.hours ?? 0), 0);
  const weeksTotal = weekCursor - 1;

  const path = await prisma.learningPath.create({
    data: {
      userId,
      attemptId,
      weeksTotal,
      hoursTotal,
      items: { create: items },
    },
    include: { items: { include: { course: true }, orderBy: { orderIndex: "asc" } } },
  });

  for (const p of picks) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId: p.courseId } },
      create: { userId, courseId: p.courseId, status: "RECOMMENDED", progressPct: 0 },
      update: {},
    });
  }

  return path;
}

export async function getLatestLearningPath(userId: string) {
  return prisma.learningPath.findFirst({
    where: { userId },
    orderBy: { generatedAt: "desc" },
    include: { items: { include: { course: true }, orderBy: { orderIndex: "asc" } } },
  });
}

export const DOMAIN_COUNT = DOMAINS.length;
