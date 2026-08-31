"use client";

import { useState } from "react";
import type { RankedCourse } from "@/lib/recommend";
import CourseProgressControl from "@/components/CourseProgressControl";

const FILTERS = ["Recommended for you", "Critical gaps", "Sampling & field ops", "Analytics tooling", "Mandatory"] as const;

type EnrollmentInfo = { status: string; progressPct: number };

export default function CatalogClient({
  courses,
  criticalDomainCodes,
  enrollmentByCourseId,
  repeatGapDomainCodes,
}: {
  courses: RankedCourse[];
  criticalDomainCodes: string[];
  enrollmentByCourseId: Record<string, EnrollmentInfo>;
  repeatGapDomainCodes: string[];
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Recommended for you");
  const critical = new Set(criticalDomainCodes);
  const repeatGapped = new Set(repeatGapDomainCodes);

  const filtered = courses.filter((c) => {
    switch (filter) {
      case "Critical gaps":
        return critical.has(c.primaryDomainCode);
      case "Sampling & field ops":
        return c.primaryDomainCode === "NSTA-C1" || c.primaryDomainCode === "NSTA-C2";
      case "Analytics tooling":
        return c.primaryDomainCode === "NSTA-C6" || c.primaryDomainCode === "NSTA-C7";
      case "Mandatory":
        return c.mandatory;
      default:
        return true;
    }
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {FILTERS.map((f) => (
          <div key={f} onClick={() => setFilter(f)} className={`pill${filter === f ? " active" : ""}`}>
            {f}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {filtered.map((c) => {
          const enrollment = enrollmentByCourseId[c.id] ?? null;
          return (
            <div key={c.id} className="card" style={{ padding: "18px 19px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                className="mono"
                style={{
                  alignSelf: "flex-start",
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#6a6f66",
                  background: "#f1f2ed",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "3px 8px",
                }}
              >
                {c.primaryDomainName || "General"}
              </div>
              <div className="mono" style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
                <span>{c.source === "IGOT_KARMAYOGI" ? "iGOT Karmayogi" : "MoSPI NSTA"}</span>
                <span>·</span>
                <span>{c.hours}h</span>
                {c.mandatory && (
                  <>
                    <span>·</span>
                    <span>mandatory</span>
                  </>
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.01em" }}>{c.title}</div>
              <div style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.5, flex: 1 }}>{c.description}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f1f2ed", paddingTop: 11, gap: 10 }}>
                <span style={{ fontSize: 12, color: c.matchPct >= 70 ? "var(--green)" : "var(--amber)", fontWeight: 600, flex: "0 0 auto" }}>{c.matchPct}% match</span>
                <CourseProgressControl
                  courseId={c.id}
                  source={c.source}
                  enrollment={enrollment}
                  stillGapped={repeatGapped.has(c.primaryDomainCode)}
                  compact
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
