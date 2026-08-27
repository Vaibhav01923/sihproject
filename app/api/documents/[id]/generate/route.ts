import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import { generateQuestions } from "@/lib/llm/quizgen";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const count = Math.min(20, Math.max(3, Number(body.count) || 8));

    const document = await prisma.document.findUnique({ where: { id } });
    if (!document || document.userId !== user.id) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const domains = await prisma.competencyDomain.findMany();
    const { questions, generatedBy } = await generateQuestions(document.extractedText, domains, count, document.pageCount);

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "Couldn't generate questions from this document - try a longer or more descriptive source file." },
        { status: 422 }
      );
    }

    await prisma.generatedQuestion.createMany({
      data: questions.map((q) => ({
        documentId: document.id,
        domainId: q.domainId,
        text: q.text,
        options: JSON.stringify(q.options),
        correctIndex: q.correctIndex,
        difficulty: q.difficulty,
        page: q.page,
        generatedBy,
      })),
    });

    return NextResponse.json({ ok: true, count: questions.length, generatedBy });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    throw e;
  }
}
