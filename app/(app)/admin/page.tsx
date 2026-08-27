import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAdminTiles, getOfficeReadiness, getTopSystemGaps } from "@/lib/analytics";
import PageHeader from "@/components/PageHeader";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!user.isAdmin) redirect("/overview");

  const [tiles, offices, topGaps] = await Promise.all([getAdminTiles(), getOfficeReadiness(), getTopSystemGaps()]);

  const tileList = [
    { label: "Staff onboarded", value: String(tiles.staffOnboarded), note: `across ${offices.length} offices (seeded pilot cohort)` },
    { label: "Diagnostics taken", value: String(tiles.diagnosticsTaken), note: `${tiles.diagnosticsPct}% of onboarded staff` },
    { label: "At benchmark", value: `${tiles.atBenchmarkPct}%`, note: "of staff who completed the diagnostic" },
    { label: "Quizzes generated", value: String(tiles.quizzesGenerated), note: `from ${tiles.documentsUploaded} uploaded documents` },
  ];

  function officeColor(pct: number) {
    if (pct >= 70) return "var(--green)";
    if (pct >= 55) return "var(--amber)";
    return "var(--red)";
  }

  const lowOffices = offices.filter((o) => o.pct < 55);

  return (
    <div>
      <PageHeader
        crumb="Administration · MoSPI"
        heading="Office analytics"
        subheading="Capacity across offices, and where a cohort intervention would pay off most."
      />

      <div className="tiles-grid">
        {tileList.map((t) => (
          <div className="tile" key={t.label}>
            <div className="label">{t.label}</div>
            <div className="value">{t.value}</div>
            <div className="note" style={{ color: "var(--ink-faint)" }}>
              {t.note}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, marginTop: 18, alignItems: "start" }}>
        <section className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)" }}>
            <h2 className="section-title">Readiness by office</h2>
            <p style={{ margin: "5px 0 0", fontSize: 13.5, color: "var(--ink-muted)" }}>Share of assessed staff at or above their role benchmark.</p>
          </div>
          {offices.map((o) => (
            <div
              key={o.name}
              style={{ display: "grid", gridTemplateColumns: "1.6fr 0.6fr 1.4fr 0.7fr", gap: 16, alignItems: "center", padding: "14px 22px", borderBottom: "1px solid #f1f2ed" }}
            >
              <div style={{ fontSize: 14, fontWeight: 500 }}>{o.name}</div>
              <div className="mono" style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
                {o.staff}
              </div>
              <div className="bar-track thin">
                <div className="bar-cur" style={{ width: `${o.pct}%`, background: officeColor(o.pct) }} />
              </div>
              <div className="mono" style={{ fontSize: 12.5, textAlign: "right" }}>
                {o.pct}%
              </div>
            </div>
          ))}
        </section>

        <section className="card" style={{ padding: "20px 22px" }}>
          <h2 className="section-title" style={{ marginBottom: 4, fontSize: 15 }}>
            System-wide gaps
          </h2>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--ink-muted)" }}>Most frequent critical gap, all offices.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {topGaps.map((g) => (
              <div key={g.name}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                  <span style={{ color: "#4a4f47" }}>{g.name}</span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                    {g.n}
                  </span>
                </div>
                <div className="bar-track" style={{ height: 5, marginTop: 6 }}>
                  <div className="bar-cur" style={{ width: `${g.pct}%`, background: "var(--blue)" }} />
                </div>
              </div>
            ))}
            {topGaps.length === 0 && <div style={{ fontSize: 13.5, color: "var(--ink-muted)" }}>No critical gaps recorded yet.</div>}
          </div>
          {lowOffices.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #eceee8", fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.55 }}>
              Recommendation: commission a cohort programme for the {lowOffices.length} office{lowOffices.length > 1 ? "s" : ""} below 55% readiness
              ({lowOffices.map((o) => o.name).join(", ")}).
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
