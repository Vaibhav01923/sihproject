import { getCurrentUser } from "@/lib/auth";
import { getLatestLearningPath, generateLearningPath, getGapAnalysis, getRankedCourses, getRepeatGapDomains } from "@/lib/recommend";
import { getPathProjection } from "@/lib/analytics";
import { db } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import CourseProgressControl from "@/components/CourseProgressControl";

export default async function PathPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: hasCompletedAssessment } = await db
    .from("AssessmentAttempt")
    .select("id")
    .eq("userId", user.id)
    .eq("status", "COMPLETED")
    .limit(1)
    .maybeSingle();
  let path = await getLatestLearningPath(user.id);

  // completeAttempt() already generates a path automatically the moment a
  // diagnostic finishes - there's no manual "regenerate" action anymore.
  // This only fires as a self-heal for a completed assessment that somehow
  // has no path yet (shouldn't happen in normal use, but leaves nobody stuck).
  if (hasCompletedAssessment && !path) {
    await generateLearningPath(user.id);
    path = await getLatestLearningPath(user.id);
  }

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
          <p style={{ margin: 0 }}>Couldn&apos;t generate a path right now - try again shortly.</p>
        </div>
      ) : (
        <PathBody userId={user.id} path={path} />
      )}
    </div>
  );
}

async function PathBody({ userId, path }: { userId: string; path: NonNullable<Awaited<ReturnType<typeof getLatestLearningPath>>> }) {
  const courseIds = path.items.map((i) => i.courseId);
  const [projection, { data: enrollmentsData }, gaps] = await Promise.all([
    getPathProjection(userId, courseIds),
    db.from("Enrollment").select("*").eq("userId", userId).in("courseId", courseIds),
    getGapAnalysis(userId),
  ]);
  const enrollments = enrollmentsData ?? [];
  const enrollmentByCourseId = Object.fromEntries(enrollments.map((e) => [e.courseId, { status: e.status, progressPct: e.progressPct }]));
  const rankedCourses = await getRankedCourses(userId, gaps);
  const repeatGaps = getRepeatGapDomains(gaps, rankedCourses);

  return (
    <div>
      {repeatGaps.length > 0 && (
        <div
          className="card"
          style={{
            padding: "14px 18px",
            marginBottom: 16,
            borderLeft: "3px solid var(--amber)",
            fontSize: 13.5,
            lineHeight: 1.5,
          }}
        >
          <strong>Still showing a gap after completing the course:</strong> {repeatGaps.map((g) => g.name).join(", ")}
          . These courses are still listed below because they&apos;re still the best match - but if you&apos;ve
          already done them once, consider revisiting the material rather than just re-enrolling, and retake the
          diagnostic once you have.
        </div>
      )}
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
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #eceee8", fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.55 }}>
          This path refreshes automatically the next time you complete the diagnostic. Completions and credits post
          automatically to your Karmayogi profile.
        </div>
        </aside>
      </div>
    </div>
  );
}
