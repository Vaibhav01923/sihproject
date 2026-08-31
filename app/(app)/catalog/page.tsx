import { getCurrentUser } from "@/lib/auth";
import { getRankedCourses, getGapAnalysis, getRepeatGapDomains } from "@/lib/recommend";
import PageHeader from "@/components/PageHeader";
import CatalogClient from "./CatalogClient";

export default async function CatalogPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const gaps = await getGapAnalysis(user.id);
  const courses = await getRankedCourses(user.id, gaps);
  const repeatGapCodes = getRepeatGapDomains(gaps, courses).map((g) => g.code);

  const criticalDomainCodes = new Set(gaps.filter((g) => g.priority === "CRITICAL").map((g) => g.code));
  // getRankedCourses already carries each course's enrollment status - no
  // separate Enrollment query needed here.
  const enrollmentByCourseId = Object.fromEntries(
    courses.filter((c) => c.enrollment).map((c) => [c.id, c.enrollment!])
  );

  return (
    <div>
      <PageHeader
        crumb="Catalog · Synced"
        heading="Course catalog"
        subheading="Courses pulled from the iGOT Karmayogi catalog, scored against your gap profile."
      />
      <CatalogClient
        courses={courses}
        criticalDomainCodes={[...criticalDomainCodes]}
        enrollmentByCourseId={enrollmentByCourseId}
        repeatGapDomainCodes={repeatGapCodes}
      />
    </div>
  );
}
