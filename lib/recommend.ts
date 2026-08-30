import { db, unwrap } from "./db";
import { newId } from "./id";
import { DOMAINS, ROLE_BENCHMARKS, priorityForGap } from "./domains";
import type { UserRow, CompetencyDomainRow, CompetencyScoreRow, CourseRow, LearningPathRow, LearningPathItemRow } from "./schema";

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
  const user: UserRow = unwrap(await db.from("User").select("*").eq("id", userId).single());
  const { data: domainsData } = await db.from("CompetencyDomain").select("*").order("order", { ascending: true });
  const domains = (domainsData ?? []) as CompetencyDomainRow[];
  const { data: scoresData } = await db
    .from("CompetencyScore")
    .select("*")
    .eq("userId", userId)
    .eq("isCurrent", true);
  const scores = (scoresData ?? []) as CompetencyScoreRow[];
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

type CourseWithDomains = CourseRow & {
  domains: { domainId: string; weight: number; domain: CompetencyDomainRow | null }[];
};

async function getCoursesWithDomains(): Promise<CourseWithDomains[]> {
  const { data, error } = await db.from("Course").select("*, domains:CourseDomain(domainId, weight, domain:CompetencyDomain(*))");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CourseWithDomains[];
}

/** Score every course by gap-severity x relevance-weight, summed across the
 * domains it covers, then rank. This is the recommendation engine. */
export async function getRankedCourses(userId: string): Promise<RankedCourse[]> {
  const gaps = await getGapAnalysis(userId);
  const gapByDomainId = new Map(gaps.map((g) => [g.domainId, g]));

  const courses = await getCoursesWithDomains();
  const maxPossible = PRIORITY_WEIGHT.CRITICAL * 1; // per unit weight, for normalisation

  return courses
    .map((c) => {
      const domainLinks = [...c.domains].sort((a, b) => b.weight - a.weight);
      let score = 0;
      let totalWeight = 0;
      for (const link of domainLinks) {
        const g = gapByDomainId.get(link.domainId);
        const severity = g ? PRIORITY_WEIGHT[g.priority] : 0;
        score += severity * link.weight;
        totalWeight += link.weight;
      }
      const normalised = totalWeight > 0 ? score / (totalWeight * maxPossible) : 0;
      const matchPct = Math.round(Math.min(1, Math.max(0.12, normalised)) * 100);
      const primary = domainLinks[0]?.domain;
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
  const courses = await getCoursesWithDomains();
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

    const gapNames = gaps.filter((g) => closesDomainIds.includes(g.domainId)).map((g) => g.name);
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
  const items = picks.map((p, i) => {
    const course = courseById.get(p.courseId)!;
    const weeks = Math.max(1, Math.ceil(course.hours / STUDY_HOURS_PER_WEEK));
    const weekStart = weekCursor;
    const weekEnd = weekCursor + weeks - 1;
    weekCursor = weekEnd + 1;
    return { id: newId(), courseId: p.courseId, orderIndex: i, weekStart, weekEnd, rationale: p.rationale };
  });

  const hoursTotal = picks.reduce((sum, p) => sum + (courseById.get(p.courseId)?.hours ?? 0), 0);
  const weeksTotal = weekCursor - 1;

  const pathId = newId();
  const generatedAt = new Date().toISOString();
  const { error: pathError } = await db
    .from("LearningPath")
    .insert({ id: pathId, userId, attemptId: attemptId ?? null, weeksTotal, hoursTotal, generatedAt });
  if (pathError) throw new Error(pathError.message);

  if (items.length > 0) {
    const { error: itemsError } = await db
      .from("LearningPathItem")
      .insert(items.map((i) => ({ ...i, pathId })));
    if (itemsError) throw new Error(itemsError.message);
  }

  for (const p of picks) {
    await db
      .from("Enrollment")
      .upsert(
        { id: newId(), userId, courseId: p.courseId, status: "RECOMMENDED", progressPct: 0 },
        { onConflict: "userId,courseId", ignoreDuplicates: true }
      );
  }

  return {
    id: pathId,
    userId,
    attemptId: attemptId ?? null,
    weeksTotal,
    hoursTotal,
    generatedAt,
    items: items.map((i) => ({ ...i, pathId, course: courseById.get(i.courseId)! })),
  };
}

export type LearningPathWithItems = LearningPathRow & {
  items: (LearningPathItemRow & { course: CourseRow })[];
};

export async function getLatestLearningPath(userId: string): Promise<LearningPathWithItems | null> {
  const { data, error } = await db
    .from("LearningPath")
    .select("*, items:LearningPathItem(*, course:Course(*))")
    .eq("userId", userId)
    .order("generatedAt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const path = data as unknown as LearningPathWithItems;
  path.items = [...path.items].sort((a, b) => a.orderIndex - b.orderIndex);
  return path;
}

export const DOMAIN_COUNT = DOMAINS.length;
