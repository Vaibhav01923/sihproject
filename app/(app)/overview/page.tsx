import { getCurrentUser } from "@/lib/auth";
import { getGapAnalysis, getRankedCourses } from "@/lib/recommend";
import { getCompetencyIndex, getHoursCompleted, getKarmayogiCredits, getCohortBenchmark } from "@/lib/analytics";
import { PRIORITY_COLOR } from "@/lib/domains";
import PageHeader from "@/components/PageHeader";

export default async function OverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [gaps, courses, index, hours, credits, cohort] = await Promise.all([
    getGapAnalysis(user.id),
    getRankedCourses(user.id),
    getCompetencyIndex(user.id),
    getHoursCompleted(user.id),
    getKarmayogiCredits(user.id),
    getCohortBenchmark(user.id),
  ]);

  const criticalCount = gaps.filter((g) => g.priority === "CRITICAL").length;
  const criticalNames = gaps.filter((g) => g.priority === "CRITICAL").map((g) => g.name).join(", ");
  const firstName = user.name.split(" ").slice(-1)[0];

  const tiles = [
    { label: "Competency index", value: String(index), note: `Across ${gaps.length} NSTA domains`, color: "var(--ink-faint)" },
    { label: "Critical gaps", value: String(criticalCount), note: criticalCount ? criticalNames : "None right now", color: "var(--red)" },
    { label: "Hours completed", value: String(hours), note: "Tracked via enrollments", color: "var(--ink-faint)" },
    { label: "Karmayogi credits", value: String(credits), note: "Courses completed & synced", color: "var(--ink-faint)" },
  ];

  return (
    <div>
      <PageHeader
        crumb="Learner · Overview"
        heading={`Good morning, ${firstName}`}
        subheading="Your competency standing, live gaps, and what the system suggests you take next."
      />

      <div className="tiles-grid">
        {tiles.map((t) => (
          <div className="tile" key={t.label}>
            <div className="label">{t.label}</div>
            <div className="value">{t.value}</div>
            <div className="note" style={{ color: t.color }}>
              {t.note}
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <section className="card" style={{ padding: "20px 22px 22px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h2 className="section-title">Competency profile</h2>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>
              role: {user.role}
            </span>
          </div>
          <p className="section-sub">Current level against the role benchmark for {user.role}.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            {gaps.map((d) => (
              <div key={d.domainId}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>{d.name}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                    L{d.current} / L{d.required}
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar-req" style={{ width: `${(d.required / 5) * 100}%` }} />
                  <div className="bar-cur" style={{ width: `${(d.current / 5) * 100}%`, background: PRIORITY_COLOR[d.priority] }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <section className="card" style={{ padding: "20px 22px 18px" }}>
            <h2 className="section-title" style={{ marginBottom: 4 }}>
              Recommended next
            </h2>
            <p className="section-sub">Ranked by gap severity × role relevance.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {courses.slice(0, 3).map((c) => (
                <div key={c.id} style={{ border: "1px solid #e6e7e1", borderRadius: 6, padding: "13px 14px" }}>
                  <div className="mono" style={{ display: "flex", gap: 7, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
                    <span>{c.source === "IGOT_KARMAYOGI" ? "iGOT Karmayogi" : "MoSPI NSTA"}</span>
                    <span>·</span>
                    <span>{c.hours}h</span>
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, marginTop: 6, lineHeight: 1.3 }}>{c.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 5 }}>{c.matchPct}% match to your gaps</div>
                </div>
              ))}
            </div>
          </section>

          <section className="card" style={{ padding: "20px 22px" }}>
            <h2 className="section-title" style={{ marginBottom: 14 }}>
              Cohort benchmark
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Your competency index", value: String(cohort.mine) },
                { label: `Peer median (${user.role})`, value: String(cohort.peerMedian) },
                { label: "Percentile in cohort", value: `${cohort.percentile}th` },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    fontSize: 13.5,
                    paddingBottom: 10,
                    borderBottom: "1px solid #f0f1ec",
                  }}
                >
                  <span style={{ color: "#4a4f47" }}>{row.label}</span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
