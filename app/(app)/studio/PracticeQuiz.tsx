"use client";

import { useState } from "react";

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

/**
 * Personal self-test with the reviewed questions from one document -
 * entirely client-side (the caller already has the full question set),
 * immediate right/wrong feedback per question, and a score at the end.
 * Deliberately not persisted anywhere: this is a study aid for whoever
 * generated the quiz, not an official record (that's what Publish to
 * Karmayogi is for, gated to admins separately).
 */
export default function PracticeQuiz({ questions, onExit }: { questions: Q[]; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  if (questions.length === 0) {
    return (
      <div className="empty-state">
        Approve at least one question before you can practice this quiz.
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-outline btn-sm" onClick={onExit}>
            Back to review
          </button>
        </div>
      </div>
    );
  }

  const q = questions[index];

  function pick(i: number) {
    if (revealed) return;
    setPicked(i);
    setRevealed(true);
    if (i === q.correctIndex) setCorrectCount((c) => c + 1);
  }

  function next() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setRevealed(false);
  }

  function restart() {
    setIndex(0);
    setPicked(null);
    setRevealed(false);
    setCorrectCount(0);
    setFinished(false);
  }

  if (finished) {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Practice complete</div>
        <div style={{ fontSize: 34, fontWeight: 600, marginTop: 14, letterSpacing: "-0.02em" }}>
          {correctCount}/{questions.length}
        </div>
        <p style={{ color: "var(--ink-muted)", fontSize: 14, marginTop: 6 }}>
          {pct}% correct - this practice run is just for your own study, not saved or scored officially.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
          <button className="btn btn-primary" onClick={restart}>
            Practice again
          </button>
          <button className="btn btn-outline" onClick={onExit}>
            Back to review
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="card" style={{ padding: "24px 26px 26px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }} className="mono">
        <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
          QUESTION {index + 1} OF {questions.length}
        </span>
        <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{q.difficulty}</span>
      </div>
      <div className="bar-track" style={{ margin: "12px 0 24px" }}>
        <div className="bar-cur" style={{ width: `${(index / questions.length) * 100}%`, background: "var(--blue)" }} />
      </div>

      <div style={{ fontSize: 19, fontWeight: 500, lineHeight: 1.45, letterSpacing: "-0.01em" }}>{q.text}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        {q.options.map((opt, i) => {
          const isPicked = picked === i;
          const isCorrect = i === q.correctIndex;
          let border = "var(--border)";
          let bg = "#fff";
          if (revealed && isCorrect) {
            border = "var(--green)";
            bg = "var(--green-tint)";
          } else if (revealed && isPicked) {
            border = "var(--red)";
            bg = "oklch(0.97 0.03 25)";
          } else if (isPicked) {
            border = "var(--blue)";
            bg = "var(--blue-tint)";
          }
          return (
            <div
              key={i}
              onClick={() => pick(i)}
              style={{
                display: "flex",
                gap: 13,
                alignItems: "flex-start",
                border: `1px solid ${border}`,
                background: bg,
                borderRadius: 6,
                padding: "14px 16px",
                cursor: revealed ? "default" : "pointer",
              }}
            >
              <span className="mono" style={{ fontSize: 12, fontWeight: 500, color: "#8b8f86", width: 16, flex: "0 0 16px" }}>
                {"ABCD"[i]}
              </span>
              <span style={{ fontSize: 14.5, lineHeight: 1.45 }}>{opt}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 26, paddingTop: 20, borderTop: "1px solid #eceee8" }}>
        <button className="btn btn-outline btn-sm" onClick={onExit}>
          Exit practice
        </button>
        <button className="btn btn-primary" onClick={next} disabled={!revealed}>
          {index + 1 < questions.length ? "Next question" : "Finish"}
        </button>
      </div>
    </section>
  );
}
