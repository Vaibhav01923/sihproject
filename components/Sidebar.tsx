"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { id: "overview", key: "OV", label: "Overview", href: "/overview" },
  { id: "assessment", key: "AS", label: "Diagnostic", href: "/assessment" },
  { id: "gaps", key: "GA", label: "Gap analysis", href: "/gaps" },
  { id: "path", key: "LP", label: "Learning path", href: "/path" },
  { id: "catalog", key: "CT", label: "Course catalog", href: "/catalog" },
  { id: "studio", key: "QS", label: "Quiz studio", href: "/studio" },
  { id: "tutor", key: "AT", label: "AI tutor", href: "/tutor" },
];

const ADMIN_NAV = { id: "admin", key: "AD", label: "Office analytics", href: "/admin" };

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Sidebar({ name, role, isAdmin }: { name: string; role: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = isAdmin ? [...NAV, ADMIN_NAV] : NAV;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-eyebrow">MoSPI · NSTA</div>
        <div className="sidebar-title">Sankhya Kaushal</div>
        <div className="sidebar-sub">Capacity building for the Official Statistical System</div>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.id} href={item.href} className={`nav-item${active ? " active" : ""}`}>
              <span className="nav-key">{item.key}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="avatar">{initials(name)}</div>
        <div>
          <div className="name">{name}</div>
          <div className="role">{role}</div>
        </div>
        <button className="sidebar-logout" onClick={logout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
