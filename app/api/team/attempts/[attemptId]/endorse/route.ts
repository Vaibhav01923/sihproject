import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";

export async function POST(_req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  try {
    const officer = await requireUser();
    const { attemptId } = await params;

    const { data: attempt } = await db
      .from("AssessmentAttempt")
      .select("id, userId, status, endorsedByUserId")
      .eq("id", attemptId)
      .maybeSingle();
    if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: owner } = await db.from("User").select("reportingOfficerId").eq("id", attempt.userId).maybeSingle();
    if (!owner || owner.reportingOfficerId !== officer.id) {
      // Don't distinguish "doesn't exist" from "not your report" - avoid leaking who reports to whom.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (attempt.status !== "COMPLETED") {
      return NextResponse.json({ error: "This diagnostic isn't complete yet" }, { status: 409 });
    }
    if (attempt.endorsedByUserId) {
      return NextResponse.json({ error: "Already endorsed" }, { status: 409 });
    }

    const { error } = await db
      .from("AssessmentAttempt")
      .update({ endorsedByUserId: officer.id, endorsedAt: new Date().toISOString() })
      .eq("id", attemptId);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    throw e;
  }
}
