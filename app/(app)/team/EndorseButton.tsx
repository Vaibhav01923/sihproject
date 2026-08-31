"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EndorseButton({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function endorse() {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/attempts/${attemptId}/endorse`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn btn-primary btn-sm" onClick={endorse} disabled={loading}>
      {loading ? "Endorsing…" : "Endorse"}
    </button>
  );
}
