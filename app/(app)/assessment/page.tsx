import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateAttempt, getNextQuestion, getCoverage } from "@/lib/assessment";
import type { AssessmentAttemptRow } from "@/lib/schema";
import PageHeader from "@/components/PageHeader";
import AssessmentClient from "./AssessmentClient";
import RetakeButton from "./RetakeButton";

export default async function AssessmentPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: latestData } = await db
    .from("AssessmentAttempt")
    .select("*")
    .eq("userId", user.id)
    .order("startedAt", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latest = latestData as AssessmentAttemptRow | null;

  if (!latest || latest.status === "COMPLETED") {
    let endorserName: string | null = null;
    if (latest?.endorsedByUserId) {
      const { data: endorser } = await db.from("User").select("name").eq("id", latest.endorsedByUserId).maybeSingle();
      endorserName = endorser?.name ?? null;
    }

    return (
      <div>
        <PageHeader
          crumb="Diagnostic · Adaptive"
          heading="Competency diagnostic"
          subheading="Twenty-four items across eight NSTA competency domains. Roughly 30 minutes."
        />
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          {latest ? (
            <>
              <div style={{ fontSize: 17, fontWeight: 600 }}>You&apos;ve already completed this diagnostic</div>
              <p style={{ color: "var(--ink-muted)", fontSize: 14, marginTop: 10 }}>
                Completed {latest.completedAt ? new Date(latest.completedAt).toLocaleDateString("en-IN") : ""}. Your gap
                analysis and learning path are based on those results.
              </p>
              {latest.completedAt && (
                <div className="igot-badge" style={{ margin: "18px auto 0" }}>
                  <span className={`dot${latest.endorsedByUserId ? "" : " simulated"}`} />
                  <div>
                    <div className="title">{latest.endorsedByUserId ? "Evaluated" : "Pending endorsement"}</div>
                    <div className="sub">
                      {latest.endorsedByUserId
                        ? `Endorsed by ${endorserName ?? "your reporting officer"} on ${new Date(latest.endorsedAt!).toLocaleDateString("en-IN")}`
                        : "Pending your reporting officer's endorsement"}
                    </div>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
                <a href="/gaps" className="btn btn-outline">
                  View gap analysis
                </a>
                <RetakeButton />
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 17, fontWeight: 600 }}>Ready when you are</div>
              <p style={{ color: "var(--ink-muted)", fontSize: 14, marginTop: 10 }}>
                24 adaptive questions across the 8 NSTA competency domains. Your results drive your gap analysis and
                learning path.
              </p>
              <div style={{ marginTop: 20 }}>
                <RetakeButton label="Start diagnostic" />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const attempt = await getOrCreateAttempt(user.id);
  const [next, coverage] = await Promise.all([getNextQuestion(attempt.id), getCoverage(attempt.id)]);
  if (!next) return null;

  return (
    <div>
      <PageHeader
        crumb="Diagnostic · Adaptive"
        heading="Competency diagnostic"
        subheading="Twenty-four items across eight NSTA competency domains. Roughly 30 minutes."
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 288px", gap: 20, alignItems: "start" }}>
        <AssessmentClient attemptId={attempt.id} initial={next} />
        <aside className="card" style={{ padding: "20px 22px" }}>
          <h2 className="section-title" style={{ marginBottom: 12, fontSize: 15 }}>
            Diagnostic coverage
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {coverage.map((c) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flex: "0 0 8px" }} />
                <span style={{ flex: 1, color: "#4a4f47" }}>{c.name}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                  {c.answered}/{c.total}
                </span>
              </div>
            ))}
          </div>
          <p style={{ margin: "18px 0 0", fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.5, borderTop: "1px solid #eceee8", paddingTop: 14 }}>
            Results write back to your iGOT Karmayogi competency passbook on submission.
          </p>
        </aside>
      </div>
    </div>
  );
}
