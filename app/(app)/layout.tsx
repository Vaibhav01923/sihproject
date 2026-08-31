import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { count } = await db.from("User").select("*", { count: "exact", head: true }).eq("reportingOfficerId", user.id);
  const hasDirectReports = (count ?? 0) > 0;

  return (
    <div className="shell">
      <Sidebar name={user.name} role={user.role} isAdmin={user.isAdmin} hasDirectReports={hasDirectReports} />
      <main className="main">{children}</main>
    </div>
  );
}
