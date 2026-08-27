"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RetakeButton({ label = "Retake diagnostic" }: { label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      await fetch("/api/assessment/retake", { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn btn-primary" onClick={start} disabled={loading}>
      {loading ? "Starting…" : label}
    </button>
  );
}
