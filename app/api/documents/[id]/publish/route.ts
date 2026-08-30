import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import { publishQuizToKarmayogi } from "@/lib/igot/client";
import type { DocumentRow } from "@/lib/schema";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const { data: document } = await db.from("Document").select("*").eq("id", id).maybeSingle();
    if (!document || (document as DocumentRow).userId !== user.id) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { data: approvedData } = await db
      .from("GeneratedQuestion")
      .select("id")
      .eq("documentId", id)
      .eq("status", "APPROVED");
    const approved = approvedData ?? [];
    if (approved.length === 0) {
      return NextResponse.json({ error: "Approve at least one question before publishing" }, { status: 400 });
    }

    const { error } = await db
      .from("GeneratedQuestion")
      .update({ status: "PUBLISHED" })
      .in("id", approved.map((q) => q.id as string));
    if (error) throw new Error(error.message);

    const result = await publishQuizToKarmayogi(user.id, id, approved.map((q) => q.id as string));
    return NextResponse.json({ ok: true, published: approved.length, result });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    throw e;
  }
}
