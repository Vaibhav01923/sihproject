import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import QuizzesClient from "./QuizzesClient";

export const dynamic = "force-dynamic"; // published quizzes change whenever anyone publishes - never cache this list

type QuizSummary = { documentId: string; filename: string; uploaderName: string; count: number };

export default async function QuizzesPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { doc: selectedDocId } = await searchParams;

  // Every PUBLISHED question across every user's documents, embedding just
  // enough of Document to group by it - this is deliberately NOT scoped to
  // the current user (unlike Quiz Studio's own document list), since the
  // whole point is other officers can see what's been published.
  const { data: publishedData } = await db
    .from("GeneratedQuestion")
    .select("documentId, document:Document(id, filename, userId)")
    .eq("status", "PUBLISHED");

  type Row = { documentId: string; document: { id: string; filename: string; userId: string } | null };
  const rows = (publishedData ?? []) as unknown as Row[];

  const byDoc = new Map<string, QuizSummary & { userId: string }>();
  for (const r of rows) {
    if (!r.document) continue;
    const existing = byDoc.get(r.documentId);
    if (existing) existing.count++;
    else byDoc.set(r.documentId, { documentId: r.documentId, filename: r.document.filename, userId: r.document.userId, uploaderName: "", count: 1 });
  }

  const uploaderIds = [...new Set(Array.from(byDoc.values()).map((q) => q.userId))];
  const { data: uploadersData } = uploaderIds.length
    ? await db.from("User").select("id, name").in("id", uploaderIds)
    : { data: [] };
  const uploaderNameById = new Map((uploadersData ?? []).map((u) => [u.id as string, u.name as string]));

  const quizzes: QuizSummary[] = Array.from(byDoc.values())
    .map((q) => ({ documentId: q.documentId, filename: q.filename, uploaderName: uploaderNameById.get(q.userId) ?? "Unknown", count: q.count }))
    .sort((a, b) => a.filename.localeCompare(b.filename));

  let practiceQuestions: {
    id: string;
    text: string;
    options: string[];
    correctIndex: number;
    difficulty: string;
    page: number | null;
    status: string;
    generatedBy: string;
    domainName: string | null;
  }[] = [];

  if (selectedDocId) {
    const [{ data: questionsData }, { data: domainsData }] = await Promise.all([
      db.from("GeneratedQuestion").select("*").eq("documentId", selectedDocId).eq("status", "PUBLISHED").order("createdAt", { ascending: true }),
      db.from("CompetencyDomain").select("*"),
    ]);
    const domainNameById = new Map((domainsData ?? []).map((d) => [d.id, d.name]));
    practiceQuestions = (questionsData ?? []).map((q) => ({
      id: q.id,
      text: q.text,
      options: JSON.parse(q.options) as string[],
      correctIndex: q.correctIndex,
      difficulty: q.difficulty,
      page: q.page,
      status: q.status,
      generatedBy: q.generatedBy,
      domainName: q.domainId ? (domainNameById.get(q.domainId) ?? null) : null,
    }));
  }

  return (
    <div>
      <PageHeader
        crumb="Authoring · AI"
        heading="Published quizzes"
        subheading="Reviewed quizzes published by anyone in your organisation - practice any of them yourself."
      />
      <QuizzesClient quizzes={quizzes} selectedDocId={selectedDocId ?? null} practiceQuestions={practiceQuestions} />
    </div>
  );
}
