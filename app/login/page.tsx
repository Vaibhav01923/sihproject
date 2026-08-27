"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push("/overview");
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
      <div style={{ width: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--ink-faint)", textTransform: "uppercase" }}>
            MoSPI · NSTA
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em", marginTop: 8 }}>Sankhya Kaushal</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-muted)", marginTop: 6 }}>
            Capacity building for the Official Statistical System
          </div>
        </div>

        <form onSubmit={onSubmit} className="card" style={{ padding: "24px 26px" }}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label htmlFor="employeeId">Employee ID</label>
            <input
              id="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="MOSPI-00001"
              autoFocus
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
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--ink-faint)", textAlign: "center" }}>
            Demo account — Employee ID <b>MOSPI-00001</b>, password <b>demo1234</b>
          </div>
        </form>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13.5, color: "var(--ink-muted)" }}>
          New to the platform? <Link href="/register">Register your profile</Link>
        </div>
      </div>
    </div>
  );
}
