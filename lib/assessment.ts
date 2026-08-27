import { prisma } from "./db";
import { DOMAINS } from "./domains";
import { Difficulty } from "./types";
import { generateLearningPath } from "./recommend";

const TIER_WEIGHT: Record<Difficulty, number> = { EASY: 1, MODERATE: 2, HARD: 3 };
const MAX_DOMAIN_WEIGHT = TIER_WEIGHT.EASY + TIER_WEIGHT.MODERATE + TIER_WEIGHT.HARD; // 6
export const QUESTIONS_PER_DOMAIN = 3;
export const TOTAL_QUESTIONS = DOMAINS.length * QUESTIONS_PER_DOMAIN; // 24

export async function getOrCreateAttempt(userId: string) {
  const existing = await prisma.assessmentAttempt.findFirst({
    where: { userId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
  });
  if (existing) return existing;
  return prisma.assessmentAttempt.create({ data: { userId } });
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
  const attempt = await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const answers = await prisma.assessmentAnswer.findMany({
    where: { attemptId },
    orderBy: { orderIndex: "asc" },
  });
  const answeredCount = answers.length;
  if (answeredCount >= TOTAL_QUESTIONS) return null;

  const domainIndex = answeredCount % DOMAINS.length;
  const domainCode = DOMAINS[domainIndex].code;
  const domain = await prisma.competencyDomain.findUniqueOrThrow({ where: { code: domainCode } });

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
  const candidates = await prisma.question.findMany({ where: { domainId, difficulty } });
  if (candidates.length === 0) return null;

  const priorAnswers = await prisma.assessmentAnswer.findMany({
    where: { attempt: { userId }, attemptId: { not: attemptId } },
    select: { questionId: true },
  });
  const seenIds = new Set(priorAnswers.map((a) => a.questionId));

  const unseen = candidates.filter((q) => !seenIds.has(q.id));
  const pool = unseen.length > 0 ? unseen : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function submitAnswer(attemptId: string, questionId: string, pickedIndex: number) {
  const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
  const orderIndex = await prisma.assessmentAnswer.count({ where: { attemptId } });

  await prisma.assessmentAnswer.create({
    data: {
      attemptId,
      questionId,
      domainId: question.domainId,
      orderIndex,
      pickedIndex,
      correct: pickedIndex === question.correctIndex,
      difficulty: question.difficulty,
    },
  });

  const totalAnswered = orderIndex + 1;
  if (totalAnswered >= TOTAL_QUESTIONS) {
    await completeAttempt(attemptId);
    return { completed: true };
  }
  return { completed: false };
}

export async function getCoverage(attemptId: string) {
  const answers = await prisma.assessmentAnswer.findMany({ where: { attemptId } });
  const domains = await prisma.competencyDomain.findMany({ orderBy: { order: "asc" } });
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
  const attempt = await prisma.assessmentAttempt.update({
    where: { id: attemptId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  const answers = await prisma.assessmentAnswer.findMany({ where: { attemptId } });
  const byDomain = new Map<string, typeof answers>();
  for (const a of answers) {
    const list = byDomain.get(a.domainId) ?? [];
    list.push(a);
    byDomain.set(a.domainId, list);
  }

  await prisma.competencyScore.updateMany({
    where: { userId: attempt.userId, isCurrent: true },
    data: { isCurrent: false },
  });

  for (const [domainId, domainAnswers] of byDomain) {
    const earned = domainAnswers.reduce((sum, a) => sum + (a.correct ? TIER_WEIGHT[a.difficulty as Difficulty] : 0), 0);
    const ratio = earned / MAX_DOMAIN_WEIGHT;
    const level = Math.min(5, Math.max(1, Math.round(1 + ratio * 4)));
    await prisma.competencyScore.create({
      data: { userId: attempt.userId, domainId, attemptId, level, ratio, isCurrent: true },
    });
  }

  await generateLearningPath(attempt.userId, attemptId);
}
