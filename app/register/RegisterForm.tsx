"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OFFICES, ROLES } from "@/lib/domains";

type Officer = { id: string; name: string; employeeId: string; office: string };

export default function RegisterForm({ officers }: { officers: Officer[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>(ROLES[0]);
  const [office, setOffice] = useState<string>(OFFICES[0]);
  const [reportingOfficerId, setReportingOfficerId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const candidateOfficers = officers.filter((o) => o.office === office);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, employeeId, password, role, office, reportingOfficerId: reportingOfficerId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push("/assessment");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--ink-faint)", textTransform: "uppercase" }}>
            MoSPI · NSTA
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em", marginTop: 8 }}>Register your profile</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-muted)", marginTop: 6 }}>
            Sets your role-competency benchmark under the NSTA framework
          </div>
        </div>

        <form onSubmit={onSubmit} className="card" style={{ padding: "24px 26px" }}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="A. Venkatesan" required />
          </div>
          <div className="field">
            <label htmlFor="employeeId">Employee ID</label>
            <input
              id="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="MOSPI-00042"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="role">Designation</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="office">Office</label>
            <select
              id="office"
              value={office}
              onChange={(e) => {
                setOffice(e.target.value);
                setReportingOfficerId(""); // clear - a previously picked officer may belong to a different office
              }}
            >
              {OFFICES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="reportingOfficer">Reporting officer</label>
            <select id="reportingOfficer" value={reportingOfficerId} onChange={(e) => setReportingOfficerId(e.target.value)}>
              <option value="">No reporting officer — I am the senior-most officer in my office</option>
              {candidateOfficers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.employeeId})
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Creating profile…" : "Create profile"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13.5, color: "var(--ink-muted)" }}>
          Already registered? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
