"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { courseExternalUrl, courseSourceLabel } from "@/lib/externalLinks";

type Enrollment = { status: string; progressPct: number } | null;

export default function CourseProgressControl({
  courseId,
  source,
  enrollment,
  compact = false,
}: {
  courseId: string;
  source: string;
  enrollment: Enrollment;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const externalUrl = courseExternalUrl(source);
  const sourceLabel = courseSourceLabel(source);

  async function enrol() {
    setBusy("enrol");
    try {
      const res = await fetch(`/api/courses/${courseId}/enroll`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function setProgress(pct: number) {
    setBusy(String(pct));
    try {
      const res = await fetch(`/api/courses/${courseId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progressPct: pct }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!enrollment) {
    return (
      <button
        onClick={enrol}
        disabled={busy === "enrol"}
        style={{ background: "none", border: "none", padding: 0, fontSize: 13, fontWeight: 600, color: "var(--blue)", cursor: "pointer" }}
      >
        {busy === "enrol" ? "Enrolling…" : "Enrol"}
      </button>
    );
  }

  if (enrollment.status === "COMPLETED") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: compact ? 12.5 : 13 }}>
        <span style={{ color: "var(--green)", fontWeight: 600 }}>✓ Completed</span>
        <a href={externalUrl} target="_blank" rel="noopener noreferrer">
          Revisit on {sourceLabel} ↗
        </a>
      </div>
    );
  }

  const presets = [25, 50, 75];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <a href={externalUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, fontSize: compact ? 12.5 : 13 }}>
          Continue on {sourceLabel} ↗
        </a>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>
          {enrollment.progressPct}%
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {presets
          .filter((p) => p > enrollment.progressPct)
          .map((p) => (
            <button key={p} className="btn btn-outline btn-sm" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setProgress(p)} disabled={!!busy}>
              {busy === String(p) ? "…" : `Mark ${p}%`}
            </button>
          ))}
        <button className="btn btn-dark btn-sm" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setProgress(100)} disabled={!!busy}>
          {busy === "100" ? "…" : "Mark complete"}
        </button>
      </div>
    </div>
  );
}
