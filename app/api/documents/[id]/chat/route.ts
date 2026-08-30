import { NextRequest, NextResponse } from "next/server";
import { db, unwrap } from "@/lib/db";
import { newId } from "@/lib/id";
import { requireUser, AuthError } from "@/lib/auth";
import { chatSchema } from "@/lib/validation";
import { answerFromDocument } from "@/lib/llm/tutor";
import type { DocumentRow, ChatMessageRow } from "@/lib/schema";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    const { data: document } = await db.from("Document").select("*").eq("id", id).maybeSingle();
    if (!document || (document as DocumentRow).userId !== user.id) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { data: historyData } = await db
      .from("ChatMessage")
      .select("*")
      .eq("documentId", id)
      .eq("userId", user.id)
      .order("createdAt", { ascending: true })
      .limit(20);
    const history = (historyData ?? []) as ChatMessageRow[];

    const { error: insertUserError } = await db
      .from("ChatMessage")
      .insert({ id: newId(), documentId: id, userId: user.id, role: "USER", content: parsed.data.message });
    if (insertUserError) throw new Error(insertUserError.message);

    const { answer } = await answerFromDocument(
      (document as DocumentRow).extractedText,
      (document as DocumentRow).filename,
      parsed.data.message,
      history.map((h) => ({ role: h.role as "USER" | "ASSISTANT", content: h.content }))
    );

    const assistantMessage: ChatMessageRow = unwrap(
      await db
        .from("ChatMessage")
        .insert({ id: newId(), documentId: id, userId: user.id, role: "ASSISTANT", content: answer })
        .select()
        .single()
    );

    return NextResponse.json({ message: { id: assistantMessage.id, role: "ASSISTANT", content: answer } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    throw e;
  }
}
