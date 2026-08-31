import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="shell">
      <Sidebar name={user.name} role={user.role} isAdmin={user.isAdmin} />
      <main className="main">{children}</main>
    </div>
  );
}
