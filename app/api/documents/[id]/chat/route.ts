import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import { chatSchema } from "@/lib/validation";
import { answerFromDocument } from "@/lib/llm/tutor";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    const document = await prisma.document.findUnique({ where: { id } });
    if (!document || document.userId !== user.id) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const history = await prisma.chatMessage.findMany({
      where: { documentId: id, userId: user.id },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    await prisma.chatMessage.create({
      data: { documentId: id, userId: user.id, role: "USER", content: parsed.data.message },
    });

    const { answer } = await answerFromDocument(
      document.extractedText,
      document.filename,
      parsed.data.message,
      history.map((h) => ({ role: h.role as "USER" | "ASSISTANT", content: h.content }))
    );

    const assistantMessage = await prisma.chatMessage.create({
      data: { documentId: id, userId: user.id, role: "ASSISTANT", content: answer },
    });

    return NextResponse.json({ message: { id: assistantMessage.id, role: "ASSISTANT", content: answer } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    throw e;
  }
}
