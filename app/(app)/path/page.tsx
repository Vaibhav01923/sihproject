import { getCurrentUser } from "@/lib/auth";
import { getLatestLearningPath } from "@/lib/recommend";
import { getPathProjection } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import GeneratePathButton from "./GeneratePathButton";
import CourseProgressControl from "@/components/CourseProgressControl";

export default async function PathPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const hasCompletedAssessment = await prisma.assessmentAttempt.findFirst({
    where: { userId: user.id, status: "COMPLETED" },
  });
  const path = await getLatestLearningPath(user.id);

  return (
    <div>
      <PageHeader
        crumb="Plan · Learning"
        heading="Your learning path"
        subheading="Sequenced to close critical gaps first, drawn from iGOT Karmayogi and NSTA course pools."
      />

      {!hasCompletedAssessment ? (
        <div className="empty-state">
          <p style={{ margin: 0 }}>Complete your competency diagnostic first so the path reflects your actual gaps.</p>
          <a href="/assessment" className="btn btn-primary" style={{ marginTop: 16 }}>
            Take the diagnostic
          </a>
        </div>
      ) : !path ? (
        <div className="empty-state">
          <p style={{ margin: 0 }}>No path generated yet.</p>
          <div style={{ marginTop: 16 }}>
            <GeneratePathButton label="Generate my path" />
          </div>
        </div>
      ) : (
        <PathBody userId={user.id} path={path} />
      )}
    </div>
  );
}

async function PathBody({ userId, path }: { userId: string; path: NonNullable<Awaited<ReturnType<typeof getLatestLearningPath>>> }) {
  const [projection, enrollments] = await Promise.all([
    getPathProjection(userId, path.items.map((i) => i.courseId)),
    prisma.enrollment.findMany({ where: { userId, courseId: { in: path.items.map((i) => i.courseId) } } }),
  ]);
  const enrollmentByCourseId = Object.fromEntries(enrollments.map((e) => [e.courseId, { status: e.status, progressPct: e.progressPct }]));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 288px", gap: 20, alignItems: "start" }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {path.items.map((p) => (
          <div key={p.id} className="card" style={{ padding: "18px 20px", display: "flex", gap: 18, alignItems: "flex-start" }}>
            <div style={{ flex: "0 0 44px", textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 10, color: "#8b8f86", letterSpacing: "0.1em" }}>
                WK
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>
                {p.weekStart === p.weekEnd ? p.weekStart : `${p.weekStart}–${p.weekEnd}`}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, borderLeft: "1px solid #eceee8", paddingLeft: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--ink-faint)",
                    border: "1px solid var(--border)",
                    borderRadius: 3,
                    padding: "2px 6px",
                  }}
                >
                  {p.course.source === "IGOT_KARMAYOGI" ? "iGOT Karmayogi" : "MoSPI NSTA"}
                </span>
                <span className="mono" style={{ fontSize: 10.5, color: "#8b8f86" }}>
                  {p.course.hours}h
                </span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8, letterSpacing: "-0.01em" }}>{p.course.title}</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-muted)", marginTop: 5, lineHeight: 1.5 }}>{p.rationale}</div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f2ed" }}>
                <CourseProgressControl courseId={p.courseId} source={p.course.source} enrollment={enrollmentByCourseId[p.courseId] ?? { status: "RECOMMENDED", progressPct: 0 }} />
              </div>
            </div>
          </div>
        ))}
      </section>

      <aside className="card" style={{ padding: "20px 22px" }}>
        <h2 className="section-title" style={{ marginBottom: 4 }}>
          Path summary
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--ink-muted)" }}>
          Generated {new Date(path.generatedAt).toLocaleDateString("en-IN")}.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {[
            { label: "Total duration", value: `${path.weeksTotal} weeks` },
            { label: "Learning hours", value: `${path.hoursTotal}h` },
            { label: "Gaps closed", value: `${projection.gapsClosed} of ${projection.openGaps}` },
            { label: "Projected index", value: `${projection.currentIndex} → ${projection.projectedIndex}` },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13.5, borderBottom: "1px solid #f1f2ed", paddingBottom: 9 }}>
              <span style={{ color: "#4a4f47" }}>{s.label}</span>
              <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <GeneratePathButton />
        </div>
        <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.55 }}>
          Completions and credits post automatically to your Karmayogi profile.
        </div>
      </aside>
    </div>
  );
}
