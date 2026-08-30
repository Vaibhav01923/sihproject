import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { requireUser, AuthError } from "@/lib/auth";
import { generateQuestions } from "@/lib/llm/quizgen";
import type { DocumentRow } from "@/lib/schema";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const count = Math.min(20, Math.max(3, Number(body.count) || 8));

    const { data: documentData } = await db.from("Document").select("*").eq("id", id).maybeSingle();
    if (!documentData || (documentData as DocumentRow).userId !== user.id) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    const document = documentData as DocumentRow;

    const { data: domains } = await db.from("CompetencyDomain").select("*");
    const { questions, generatedBy } = await generateQuestions(document.extractedText, domains ?? [], count, document.pageCount);

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "Couldn't generate questions from this document - try a longer or more descriptive source file." },
        { status: 422 }
      );
    }

    const { error } = await db.from("GeneratedQuestion").insert(
      questions.map((q) => ({
        id: newId(),
        documentId: document.id,
        domainId: q.domainId,
        text: q.text,
        options: JSON.stringify(q.options),
        correctIndex: q.correctIndex,
        difficulty: q.difficulty,
        page: q.page,
        generatedBy,
      }))
    );
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, count: questions.length, generatedBy });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    throw e;
  }
}
