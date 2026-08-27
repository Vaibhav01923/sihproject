import { getCurrentUser } from "@/lib/auth";
import { getRankedCourses, getGapAnalysis } from "@/lib/recommend";
import { prisma } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import CatalogClient from "./CatalogClient";

export default async function CatalogPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [courses, gaps, enrollments] = await Promise.all([
    getRankedCourses(user.id),
    getGapAnalysis(user.id),
    prisma.enrollment.findMany({ where: { userId: user.id } }),
  ]);

  const criticalDomainCodes = new Set(gaps.filter((g) => g.priority === "CRITICAL").map((g) => g.code));
  const enrollmentByCourseId = Object.fromEntries(
    enrollments.map((e) => [e.courseId, { status: e.status, progressPct: e.progressPct }])
  );

  return (
    <div>
      <PageHeader
        crumb="Catalog · Synced"
        heading="Course catalog"
        subheading="Courses pulled from the iGOT Karmayogi catalog, scored against your gap profile."
      />
      <CatalogClient courses={courses} criticalDomainCodes={[...criticalDomainCodes]} enrollmentByCourseId={enrollmentByCourseId} />
    </div>
  );
}
