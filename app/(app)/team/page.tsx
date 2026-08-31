import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDirectReports } from "@/lib/team";
import PageHeader from "@/components/PageHeader";
import EndorseButton from "./EndorseButton";

const COLUMNS = "2fr 1.3fr 0.8fr 0.9fr 1.4fr";

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const reports = await getDirectReports(user.id);
  if (reports.length === 0) redirect("/overview"); // defense-in-depth; sidebar already hides this link

  return (
    <div>
      <PageHeader
        crumb="Team · Endorsement"
        heading="My team"
        subheading="Your direct reports' diagnostic status, competency index, and endorsement."
        showIgot={false}
      />

      <section className="card" style={{ overflow: "hidden" }}>
        <div
          className="mono"
          style={{
            display: "grid",
            gridTemplateColumns: COLUMNS,
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
          <span>Employee</span>
          <span>Diagnostic</span>
          <span>Index</span>
          <span>Critical gaps</span>
          <span>Endorsement</span>
        </div>

        {reports.map((r) => (
          <div
            key={r.id}
            style={{
              display: "grid",
              gridTemplateColumns: COLUMNS,
              gap: 14,
              alignItems: "center",
              padding: "15px 22px",
              borderBottom: "1px solid #f1f2ed",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</div>
              <div className="mono" style={{ fontSize: 10.5, color: "#8b8f86", marginTop: 3 }}>
                {r.employeeId}
              </div>
            </div>
            <span style={{ fontSize: 13 }}>
              {!r.latestAttempt ? "Not started" : r.latestAttempt.status === "COMPLETED" ? "Completed" : "In progress"}
            </span>
            <span className="mono" style={{ fontSize: 13 }}>
              {r.competencyIndex}
            </span>
            <span className="mono" style={{ fontSize: 13, color: r.criticalGapCount > 0 ? "var(--red)" : "var(--ink-faint)" }}>
              {r.criticalGapCount}
            </span>
            <div>
              {r.latestAttempt?.status === "COMPLETED" ? (
                r.latestAttempt.endorsedByUserId ? (
                  <div className="igot-badge">
                    <span className="dot" />
                    <div>
                      <div className="title">Endorsed</div>
                      <div className="sub">{new Date(r.latestAttempt.endorsedAt!).toLocaleDateString("en-IN")}</div>
                    </div>
                  </div>
                ) : (
                  <EndorseButton attemptId={r.latestAttempt.id} />
                )
              ) : (
                <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>—</span>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
