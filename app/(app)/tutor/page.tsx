import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import { llmAvailable } from "@/lib/llm/quizgen";
import TutorClient from "./TutorClient";

export default async function TutorPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { doc } = await searchParams;

  const documents = await prisma.document.findMany({
    where: { userId: user.id, status: "PARSED" },
    orderBy: { uploadedAt: "desc" },
  });
  const selected = documents.find((d) => d.id === doc) ?? documents[0] ?? null;

  const history = selected
    ? await prisma.chatMessage.findMany({
        where: { documentId: selected.id, userId: user.id },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return (
    <div>
      <PageHeader
        crumb="AI Tutor · Grounded in your documents"
        heading="Ask the AI tutor"
        subheading="Chat about a document you've uploaded in Quiz Studio. Answers are grounded in that document's text, not general knowledge."
      />
      {!llmAvailable() && (
        <div className="form-error" style={{ marginBottom: 18 }}>
          No OPENAI_API_KEY is configured, so answers fall back to a plain keyword search over the document instead
          of a reasoned response. Set it in .env to enable full conversational answers.
        </div>
      )}
      <TutorClient
        documents={documents.map((d) => ({ id: d.id, filename: d.filename }))}
        selectedId={selected?.id ?? null}
        initialMessages={history.map((h) => ({ id: h.id, role: h.role as "USER" | "ASSISTANT", content: h.content }))}
      />
    </div>
  );
}
