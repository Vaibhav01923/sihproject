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
}: {
  courses: RankedCourse[];
  criticalDomainCodes: string[];
  enrollmentByCourseId: Record<string, EnrollmentInfo>;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Recommended for you");
  const critical = new Set(criticalDomainCodes);

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
                style={{
                  height: 74,
                  borderRadius: 5,
                  background: "#f1f2ed repeating-linear-gradient(135deg, #e6e8e1 0 6px, transparent 6px 12px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span className="mono" style={{ fontSize: 10, letterSpacing: "0.08em", color: "#8b8f86", textTransform: "uppercase" }}>
                  {c.primaryDomainCode || "course"}
                </span>
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
                <CourseProgressControl courseId={c.id} source={c.source} enrollment={enrollment} compact />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
