import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import StudioClient from "./StudioClient";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { doc } = await searchParams;

  const documents = await prisma.document.findMany({ where: { userId: user.id }, orderBy: { uploadedAt: "desc" } });
  const selected = documents.find((d) => d.id === doc) ?? documents[0] ?? null;

  const domains = await prisma.competencyDomain.findMany({ orderBy: { order: "asc" } });
  const domainNameById = new Map(domains.map((d) => [d.id, d.name]));

  const rawQuestions = selected
    ? await prisma.generatedQuestion.findMany({ where: { documentId: selected.id }, orderBy: { createdAt: "asc" } })
    : [];

  const questions = rawQuestions.map((q) => ({
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

  return (
    <div>
      <PageHeader
        crumb="Authoring · AI"
        heading="Quiz studio"
        subheading="Upload departmental material and generate reviewed MCQs mapped to competencies."
      />
      <StudioClient
        documents={documents.map((d) => ({
          id: d.id,
          filename: d.filename,
          pageCount: d.pageCount,
          conceptCount: d.conceptCount,
          status: d.status,
        }))}
        selectedId={selected?.id ?? null}
        questions={questions}
      />
    </div>
  );
}
