"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type NavItem = { id: string; key: string; label: string; href: string };

const MY_DEVELOPMENT: NavItem[] = [
  { id: "overview", key: "OV", label: "Overview", href: "/overview" },
  { id: "assessment", key: "AS", label: "Diagnostic", href: "/assessment" },
  { id: "gaps", key: "GA", label: "Gap analysis", href: "/gaps" },
  { id: "path", key: "LP", label: "Learning path", href: "/path" },
  { id: "catalog", key: "CT", label: "Course catalog", href: "/catalog" },
];
const AUTHORING_AI: NavItem[] = [
  { id: "studio", key: "QS", label: "Quiz studio", href: "/studio" },
  { id: "quizzes", key: "PQ", label: "Published quizzes", href: "/quizzes" },
  { id: "tutor", key: "AT", label: "AI tutor", href: "/tutor" },
];
const TEAM: NavItem[] = [{ id: "team", key: "TM", label: "My team", href: "/team" }];
const ADMINISTRATION: NavItem[] = [{ id: "admin", key: "AD", label: "Office analytics", href: "/admin" }];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Sidebar({
  name,
  role,
  isAdmin,
  hasDirectReports,
}: {
  name: string;
  role: string;
  isAdmin: boolean;
  hasDirectReports: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const sections = [
    { title: "My development", items: MY_DEVELOPMENT },
    { title: "Authoring & AI", items: AUTHORING_AI },
    ...(hasDirectReports ? [{ title: "Team", items: TEAM }] : []),
    ...(isAdmin ? [{ title: "Administration", items: ADMINISTRATION }] : []),
  ];

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
        {sections.map((section) => (
          <div key={section.title} className="nav-section">
            <div className="nav-section-title">{section.title}</div>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.id} href={item.href} className={`nav-item${active ? " active" : ""}`}>
                  <span className="nav-key">{item.key}</span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
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
