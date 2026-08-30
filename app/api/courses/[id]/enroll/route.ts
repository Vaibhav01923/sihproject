import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { requireUser, AuthError } from "@/lib/auth";
import { pushProgress } from "@/lib/igot/client";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: courseId } = await params;

    const { data: course } = await db.from("Course").select("id").eq("id", courseId).maybeSingle();
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    const { data: existing } = await db
      .from("Enrollment")
      .select("*")
      .eq("userId", user.id)
      .eq("courseId", courseId)
      .maybeSingle();

    let progressPct: number;
    if (existing) {
      const { data: updated, error } = await db
        .from("Enrollment")
        .update({ status: "ENROLLED" })
        .eq("userId", user.id)
        .eq("courseId", courseId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      progressPct = updated.progressPct;
    } else {
      const { data: created, error } = await db
        .from("Enrollment")
        .insert({ id: newId(), userId: user.id, courseId, status: "ENROLLED", progressPct: 0 })
        .select()
        .single();
      if (error) throw new Error(error.message);
      progressPct = created.progressPct;
    }

    await pushProgress(user.id, courseId, progressPct);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    throw e;
  }
}
