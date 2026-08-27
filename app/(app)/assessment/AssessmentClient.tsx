"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type QuestionView = {
  question: { id: string; text: string; options: string[]; domainCode: string; domainName: string };
  progress: { number: number; total: number; domainsCovered: number };
};

export default function AssessmentClient({ attemptId, initial }: { attemptId: string; initial: QuestionView }) {
  const router = useRouter();
  const [current, setCurrent] = useState(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function next() {
    if (picked === null) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/assessment/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, questionId: current.question.id, pickedIndex: picked }),
      });
      const data = await res.json();
      if (!res.ok) return;
      if (data.completed) {
        setDone(true);
        router.refresh();
        return;
      }
      setCurrent(data.next);
      setPicked(null);
      router.refresh(); // re-fetches the coverage sidebar server-side without resetting this component's state
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="card" style={{ padding: "60px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Diagnostic complete</div>
        <p style={{ color: "var(--ink-muted)", fontSize: 14, marginTop: 10 }}>
          Your competency profile has been recalculated and synced to your iGOT Karmayogi passbook.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
          <a href="/gaps" className="btn btn-primary">
            View gap analysis
          </a>
          <a href="/path" className="btn btn-outline">
            View learning path
          </a>
        </div>
      </div>
    );
  }

  const { question, progress } = current;
  const progressPct = (progress.number / progress.total) * 100;

  return (
    <section className="card" style={{ padding: "24px 26px 26px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }} className="mono">
        <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
          QUESTION {progress.number} OF {progress.total}
        </span>
        <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{question.domainCode}</span>
      </div>
      <div className="bar-track" style={{ margin: "12px 0 24px" }}>
        <div className="bar-cur" style={{ width: `${progressPct}%`, background: "var(--blue)" }} />
      </div>

      <div style={{ fontSize: 19, fontWeight: 500, lineHeight: 1.45, letterSpacing: "-0.01em" }}>{question.text}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        {question.options.map((opt, i) => {
          const active = picked === i;
          return (
            <div
              key={i}
              onClick={() => setPicked(i)}
              style={{
                display: "flex",
                gap: 13,
                alignItems: "flex-start",
                border: `1px solid ${active ? "var(--blue)" : "var(--border)"}`,
                background: active ? "var(--blue-tint)" : "#fff",
                borderRadius: 6,
                padding: "14px 16px",
                cursor: "pointer",
              }}
            >
              <span className="mono" style={{ fontSize: 12, fontWeight: 500, color: active ? "var(--blue)" : "#8b8f86", width: 16, flex: "0 0 16px" }}>
                {"ABCD"[i]}
              </span>
              <span style={{ fontSize: 14.5, lineHeight: 1.45 }}>{opt}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 26, paddingTop: 20, borderTop: "1px solid #eceee8" }}>
        <span style={{ fontSize: 13, color: "var(--ink-faint)" }}>Adaptive: difficulty adjusts to your last answer in this domain.</span>
        <button className="btn btn-primary" onClick={next} disabled={picked === null || submitting}>
          {submitting ? "Saving…" : progress.number < progress.total ? "Next question" : "Submit section"}
        </button>
      </div>
    </section>
  );
}
