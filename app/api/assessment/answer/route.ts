import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import { answerSchema } from "@/lib/validation";
import { submitAnswer, getNextQuestion } from "@/lib/assessment";
import { syncCompetencyPassbook } from "@/lib/igot/client";
import { getGapAnalysis } from "@/lib/recommend";

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { attemptId, questionId, pickedIndex } = parsed.data;

  const { data: attempt } = await db.from("AssessmentAttempt").select("*").eq("id", attemptId).maybeSingle();
  if (!attempt || attempt.userId !== user.id) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.status === "COMPLETED") {
    return NextResponse.json({ error: "This attempt is already complete" }, { status: 409 });
  }

  const result = await submitAnswer(attemptId, questionId, pickedIndex);

  if (result.completed) {
    const gaps = await getGapAnalysis(user.id);
    await syncCompetencyPassbook(
      user.id,
      gaps.map((g) => ({ code: g.code, name: g.name, level: g.current }))
    );
    return NextResponse.json({ completed: true });
  }

  const next = await getNextQuestion(attemptId);
  return NextResponse.json({ completed: false, next });
}
