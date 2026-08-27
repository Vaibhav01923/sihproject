import { getCurrentUser } from "@/lib/auth";
import { getGapAnalysis } from "@/lib/recommend";
import { PRIORITY_COLOR } from "@/lib/domains";
import PageHeader from "@/components/PageHeader";

export default async function GapsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const gaps = await getGapAnalysis(user.id);

  const critical = gaps.filter((g) => g.priority === "CRITICAL").length;
  const high = gaps.filter((g) => g.priority === "HIGH").length;
  const met = gaps.filter((g) => g.priority === "MET").length;

  const summary = [
    { count: critical, label: "Critical gaps", note: "Two or more levels below benchmark", color: PRIORITY_COLOR.CRITICAL },
    { count: high, label: "High-priority gaps", note: "One level below, role-central", color: PRIORITY_COLOR.HIGH },
    { count: met, label: "At or above benchmark", note: "Maintain through refreshers", color: PRIORITY_COLOR.MET },
  ];

  return (
    <div>
      <PageHeader
        crumb="Analysis · Role benchmark"
        heading="Competency gap analysis"
        subheading="Where you sit against the benchmark for your role, and how each gap was inferred."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 18 }}>
        {summary.map((g) => (
          <div key={g.label} className="card" style={{ borderLeft: `3px solid ${g.color}`, padding: "16px 18px" }}>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{g.count}</div>
            <div style={{ fontSize: 13.5, color: "#4a4f47", marginTop: 3 }}>{g.label}</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 6 }}>{g.note}</div>
          </div>
        ))}
      </div>

      <section className="card" style={{ overflow: "hidden" }}>
        <div
          className="mono"
          style={{
            display: "grid",
            gridTemplateColumns: "2.2fr 0.7fr 0.7fr 1.5fr 1.1fr",
            gap: 14,
            padding: "13px 22px",
            background: "#fafbf8",
            borderBottom: "1px solid var(--border)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
          }}
        >
          <span>Competency</span>
          <span>Current</span>
          <span>Required</span>
          <span>Gap</span>
          <span>Priority</span>
        </div>
        {gaps.map((d) => (
          <div
            key={d.domainId}
            style={{
              display: "grid",
              gridTemplateColumns: "2.2fr 0.7fr 0.7fr 1.5fr 1.1fr",
              gap: 14,
              alignItems: "center",
              padding: "15px 22px",
              borderBottom: "1px solid #f1f2ed",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{d.name}</div>
              <div className="mono" style={{ fontSize: 10.5, color: "#8b8f86", marginTop: 3 }}>
                {d.code}
              </div>
            </div>
            <span className="mono" style={{ fontSize: 13 }}>
              L{d.current}
            </span>
            <span className="mono" style={{ fontSize: 13, color: "var(--ink-faint)" }}>
              L{d.required}
            </span>
            <div className="bar-track thin">
              <div
                className="bar-cur"
                style={{ width: `${Math.max(4, (Math.max(0, d.gap) / 3) * 100)}%`, background: PRIORITY_COLOR[d.priority] }}
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: PRIORITY_COLOR[d.priority], letterSpacing: "0.02em" }}>{d.priority}</span>
          </div>
        ))}
      </section>

      <div style={{ display: "flex", gap: 14, marginTop: 18, alignItems: "stretch" }}>
        <div className="card" style={{ flex: 1, padding: "20px 22px" }}>
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            How this was derived
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.6 }}>
            Each domain&apos;s current level comes from a difficulty-weighted score across the three adaptive diagnostic
            items you answered in that domain (easy = 1pt, moderate = 2pt, hard = 3pt of a 6pt max), mapped onto a
            1-5 scale. The required level comes from the NSTA role-competency benchmark for {user.role}.
          </p>
        </div>
        <div style={{ flex: "0 0 260px", background: "var(--sidebar)", color: "var(--sidebar-text)", borderRadius: 7, padding: "20px 22px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--sidebar-muted)" }}>
              Next step
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8, lineHeight: 1.35 }}>Generate a learning path</div>
          </div>
          <a href="/path" className="btn" style={{ marginTop: 18, background: "#e7eae6", color: "var(--sidebar)", textAlign: "center", justifyContent: "center" }}>
            Build path
          </a>
        </div>
      </div>
    </div>
  );
}
