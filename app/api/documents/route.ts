import { NextRequest, NextResponse } from "next/server";
import { db, unwrap } from "@/lib/db";
import { newId } from "@/lib/id";
import { requireUser, AuthError } from "@/lib/auth";
import { estimateConceptCount } from "@/lib/llm/quizgen";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB - a prototype limit, not a platform one

// Collapses horizontal whitespace and excess blank lines, but keeps line
// breaks intact - the heuristic quiz generator treats them as hard sentence
// boundaries so an unpunctuated heading can't glue onto the next paragraph.
function normaliseExtractedText(input: string) {
  return input
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File is too large (15MB limit for this prototype)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text: string;
    let pageCount: number | null = null;

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      text = data.text;
      pageCount = data.numpages;
    } else {
      text = buffer.toString("utf-8");
    }

    text = normaliseExtractedText(text);
    if (text.length < 100) {
      return NextResponse.json({ error: "Couldn't extract enough text from this file" }, { status: 400 });
    }

    const document: { id: string } = unwrap(
      await db
        .from("Document")
        .insert({
          id: newId(),
          userId: user.id,
          filename: file.name,
          mimeType: file.type || "text/plain",
          sizeBytes: file.size,
          pageCount,
          conceptCount: estimateConceptCount(text),
          extractedText: text,
          status: "PARSED",
        })
        .select("id")
        .single()
    );

    return NextResponse.json({ id: document.id });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    console.error("Document upload failed:", e);
    return NextResponse.json({ error: "Failed to parse document" }, { status: 500 });
  }
}
