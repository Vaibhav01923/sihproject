import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import { pushProgress } from "@/lib/igot/client";

const schema = z.object({ progressPct: z.number().int().min(0).max(100) });

// Self-reported progress, same as most real training platforms (with or
// without an underlying video-watch tracker, completion ultimately comes
// down to the learner marking it). This is the only place Enrollment.progressPct
// is ever written after initial enrollment, which is what actually drives
// the Hours Completed / Karmayogi Credits tiles on Overview.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: courseId } = await params;
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid progress value" }, { status: 400 });
    }

    const { data: existing } = await db
      .from("Enrollment")
      .select("id")
      .eq("userId", user.id)
      .eq("courseId", courseId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: "Not enrolled in this course" }, { status: 404 });
    }

    const progressPct = parsed.data.progressPct;
    const status = progressPct >= 100 ? "COMPLETED" : progressPct > 0 ? "IN_PROGRESS" : "ENROLLED";

    const { data: updated, error } = await db
      .from("Enrollment")
      .update({ progressPct, status, completedAt: status === "COMPLETED" ? new Date().toISOString() : null })
      .eq("userId", user.id)
      .eq("courseId", courseId)
      .select()
      .single();
    if (error) throw new Error(error.message);

    await pushProgress(user.id, courseId, progressPct);
    return NextResponse.json({ ok: true, enrollment: { status: updated.status, progressPct: updated.progressPct } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    throw e;
  }
}
