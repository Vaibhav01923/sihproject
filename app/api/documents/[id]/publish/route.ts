import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import { publishQuizToKarmayogi } from "@/lib/igot/client";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const document = await prisma.document.findUnique({ where: { id } });
    if (!document || document.userId !== user.id) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const approved = await prisma.generatedQuestion.findMany({ where: { documentId: id, status: "APPROVED" } });
    if (approved.length === 0) {
      return NextResponse.json({ error: "Approve at least one question before publishing" }, { status: 400 });
    }

    await prisma.generatedQuestion.updateMany({
      where: { id: { in: approved.map((q) => q.id) } },
      data: { status: "PUBLISHED" },
    });

    const result = await publishQuizToKarmayogi(user.id, id, approved.map((q) => q.id));
    return NextResponse.json({ ok: true, published: approved.length, result });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    throw e;
  }
}
