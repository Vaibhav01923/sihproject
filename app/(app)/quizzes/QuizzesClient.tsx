"use client";

import { useRouter } from "next/navigation";
import PracticeQuiz from "@/components/PracticeQuiz";

type QuizSummary = { documentId: string; filename: string; uploaderName: string; count: number };
type Q = {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  difficulty: string;
  page: number | null;
  status: string;
  generatedBy: string;
  domainName: string | null;
};

export default function QuizzesClient({
  quizzes,
  selectedDocId,
  practiceQuestions,
}: {
  quizzes: QuizSummary[];
  selectedDocId: string | null;
  practiceQuestions: Q[];
}) {
  const router = useRouter();

  if (selectedDocId) {
    return <PracticeQuiz questions={practiceQuestions} onExit={() => router.push("/quizzes")} />;
  }

  if (quizzes.length === 0) {
    return (
      <div className="empty-state">
        No quizzes have been published yet. Once an administrator publishes one from Quiz Studio, it&apos;ll show up
        here for everyone to practice.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
      {quizzes.map((q) => (
        <div key={q.documentId} className="card" style={{ padding: "18px 19px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
            {q.count} question{q.count === 1 ? "" : "s"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.01em" }}>{q.filename}</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-muted)", flex: 1 }}>Published by {q.uploaderName}</div>
          <button className="btn btn-primary btn-sm" onClick={() => router.push(`/quizzes?doc=${q.documentId}`)}>
            Practice
          </button>
        </div>
      ))}
    </div>
  );
}
