import { db } from "@/lib/db";
import { IGOT_LIVE } from "@/lib/igot/client";

export default async function IgotBadge() {
  const { data: last } = await db
    .from("IgotSyncLog")
    .select("createdAt")
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();
  const time = last
    ? new Date(last.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
    : null;

  return (
    <div className="igot-badge">
      <span className={`dot${IGOT_LIVE ? "" : " simulated"}`} />
      <div>
        <div className="title">iGOT Karmayogi</div>
        <div className="sub">{IGOT_LIVE ? (time ? `synced ${time} IST` : "live") : time ? `simulated · synced ${time} IST` : "simulated · not yet synced"}</div>
      </div>
    </div>
  );
}
