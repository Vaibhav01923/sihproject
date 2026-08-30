import { db, unwrap } from "./db";
import { newId } from "./id";
import { DOMAINS } from "./domains";
import { Difficulty } from "./types";
import { generateLearningPath } from "./recommend";
import type { AssessmentAttemptRow, AssessmentAnswerRow, QuestionRow, CompetencyDomainRow } from "./schema";

const TIER_WEIGHT: Record<Difficulty, number> = { EASY: 1, MODERATE: 2, HARD: 3 };
const MAX_DOMAIN_WEIGHT = TIER_WEIGHT.EASY + TIER_WEIGHT.MODERATE + TIER_WEIGHT.HARD; // 6
export const QUESTIONS_PER_DOMAIN = 3;
export const TOTAL_QUESTIONS = DOMAINS.length * QUESTIONS_PER_DOMAIN; // 24

export async function getOrCreateAttempt(userId: string): Promise<AssessmentAttemptRow> {
  const { data: existing } = await db
    .from("AssessmentAttempt")
    .select("*")
    .eq("userId", userId)
    .eq("status", "IN_PROGRESS")
    .order("startedAt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing as AssessmentAttemptRow;

  return unwrap(await db.from("AssessmentAttempt").insert({ id: newId(), userId }).select().single());
}

/**
 * Round-robin across the 8 domains, 3 rounds. Round 1 always serves the
 * MODERATE item for a domain. The domain's round-2 item is HARD if round 1
 * was answered correctly, else EASY - a simple, deterministic adaptive
 * branch. Round 3 serves whichever of EASY/HARD is still unused, so every
 * domain ends up with exactly one answer at each difficulty tier, keeping
 * scoring fair regardless of the path taken to get there.
 */
export async function getNextQuestion(attemptId: string) {
  const attempt: AssessmentAttemptRow = unwrap(
    await db.from("AssessmentAttempt").select("*").eq("id", attemptId).single()
  );
  const { data: answersData } = await db
    .from("AssessmentAnswer")
    .select("*")
    .eq("attemptId", attemptId)
    .order("orderIndex", { ascending: true });
  const answers = (answersData ?? []) as AssessmentAnswerRow[];
  const answeredCount = answers.length;
  if (answeredCount >= TOTAL_QUESTIONS) return null;

  const domainIndex = answeredCount % DOMAINS.length;
  const domainCode = DOMAINS[domainIndex].code;
  const domain: CompetencyDomainRow = unwrap(
    await db.from("CompetencyDomain").select("*").eq("code", domainCode).single()
  );

  const domainAnswers = answers.filter((a) => a.domainId === domain.id);
  let neededDifficulty: Difficulty;
  if (domainAnswers.length === 0) {
    neededDifficulty = "MODERATE";
  } else if (domainAnswers.length === 1) {
    neededDifficulty = domainAnswers[0].correct ? "HARD" : "EASY";
  } else {
    const used = new Set(domainAnswers.map((a) => a.difficulty));
    neededDifficulty = used.has("EASY") ? "HARD" : "EASY";
  }

  const question = await pickQuestion(attempt.userId, attemptId, domain.id, neededDifficulty);
  if (!question) throw new Error(`No ${neededDifficulty} question seeded for ${domainCode}`);

  return {
    question: {
      id: question.id,
      text: question.text,
      options: JSON.parse(question.options) as string[],
      domainCode: domain.code,
      domainName: domain.name,
    },
    progress: {
      number: answeredCount + 1,
      total: TOTAL_QUESTIONS,
      domainsCovered: new Set(answers.map((a) => a.domainId)).size,
    },
  };
}

/**
 * Picks randomly from every question seeded for this domain+difficulty,
 * preferring ones this user has never been asked before (across all of
 * their past attempts, not just this one) so retaking the diagnostic draws
 * a different set of questions instead of the same ones verbatim. Falls
 * back to the full pool only once a user has exhausted every question in
 * that slot across enough retakes.
 */
async function pickQuestion(userId: string, attemptId: string, domainId: string, difficulty: Difficulty) {
  const { data: candidatesData } = await db
    .from("Question")
    .select("*")
    .eq("domainId", domainId)
    .eq("difficulty", difficulty);
  const candidates = (candidatesData ?? []) as QuestionRow[];
  if (candidates.length === 0) return null;

  const { data: priorAttempts } = await db
    .from("AssessmentAttempt")
    .select("id")
    .eq("userId", userId)
    .neq("id", attemptId);
  const priorAttemptIds = (priorAttempts ?? []).map((a) => a.id as string);

  let seenIds = new Set<string>();
  if (priorAttemptIds.length > 0) {
    const { data: priorAnswers } = await db
      .from("AssessmentAnswer")
      .select("questionId")
      .in("attemptId", priorAttemptIds);
    seenIds = new Set((priorAnswers ?? []).map((a) => a.questionId as string));
  }

  const unseen = candidates.filter((q) => !seenIds.has(q.id));
  const pool = unseen.length > 0 ? unseen : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function submitAnswer(attemptId: string, questionId: string, pickedIndex: number) {
  const question: QuestionRow = unwrap(await db.from("Question").select("*").eq("id", questionId).single());
  const { count } = await db
    .from("AssessmentAnswer")
    .select("*", { count: "exact", head: true })
    .eq("attemptId", attemptId);
  const orderIndex = count ?? 0;

  const { error } = await db.from("AssessmentAnswer").insert({
    id: newId(),
    attemptId,
    questionId,
    domainId: question.domainId,
    orderIndex,
    pickedIndex,
    correct: pickedIndex === question.correctIndex,
    difficulty: question.difficulty,
  });
  if (error) throw new Error(error.message);

  const totalAnswered = orderIndex + 1;
  if (totalAnswered >= TOTAL_QUESTIONS) {
    await completeAttempt(attemptId);
    return { completed: true };
  }
  return { completed: false };
}

export async function getCoverage(attemptId: string) {
  const { data: answersData } = await db.from("AssessmentAnswer").select("*").eq("attemptId", attemptId);
  const answers = (answersData ?? []) as AssessmentAnswerRow[];
  const { data: domainsData } = await db.from("CompetencyDomain").select("*").order("order", { ascending: true });
  const domains = (domainsData ?? []) as CompetencyDomainRow[];

  return domains.map((d) => {
    const domainAnswers = answers.filter((a) => a.domainId === d.id);
    const correct = domainAnswers.filter((a) => a.correct).length;
    return {
      name: d.name,
      answered: domainAnswers.length,
      total: QUESTIONS_PER_DOMAIN,
      color:
        domainAnswers.length === 0
          ? "#c4c8bd"
          : correct / domainAnswers.length >= 0.66
            ? "oklch(0.52 0.09 152)"
            : correct / domainAnswers.length >= 0.34
              ? "oklch(0.62 0.11 70)"
              : "oklch(0.52 0.13 25)",
    };
  });
}

async function completeAttempt(attemptId: string) {
  const attempt: AssessmentAttemptRow = unwrap(
    await db
      .from("AssessmentAttempt")
      .update({ status: "COMPLETED", completedAt: new Date().toISOString() })
      .eq("id", attemptId)
      .select()
      .single()
  );

  const { data: answersData } = await db.from("AssessmentAnswer").select("*").eq("attemptId", attemptId);
  const answers = (answersData ?? []) as AssessmentAnswerRow[];
  const byDomain = new Map<string, AssessmentAnswerRow[]>();
  for (const a of answers) {
    const list = byDomain.get(a.domainId) ?? [];
    list.push(a);
    byDomain.set(a.domainId, list);
  }

  await db.from("CompetencyScore").update({ isCurrent: false }).eq("userId", attempt.userId).eq("isCurrent", true);

  const newScores = Array.from(byDomain.entries()).map(([domainId, domainAnswers]) => {
    const earned = domainAnswers.reduce((sum, a) => sum + (a.correct ? TIER_WEIGHT[a.difficulty as Difficulty] : 0), 0);
    const ratio = earned / MAX_DOMAIN_WEIGHT;
    const level = Math.min(5, Math.max(1, Math.round(1 + ratio * 4)));
    return { id: newId(), userId: attempt.userId, domainId, attemptId, level, ratio, isCurrent: true };
  });
  const { error } = await db.from("CompetencyScore").insert(newScores);
  if (error) throw new Error(error.message);

  await generateLearningPath(attempt.userId, attemptId);
}
