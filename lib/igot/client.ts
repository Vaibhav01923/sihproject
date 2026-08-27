import { prisma } from "../db";
import { IgotLogKind } from "../types";

/**
 * iGOT Karmayogi connector.
 *
 * The real iGOT Karmayogi platform (igotkarmayogi.gov.in) does not offer
 * public self-serve API credentials - integration requires a government
 * sandbox onboarding process. This module is written to the shape a real
 * connector would have (base URL + bearer key, one function per
 * integration point) and runs in SIMULATED mode whenever IGOT_API_BASE_URL
 * / IGOT_API_KEY are unset, which is the default for this prototype.
 *
 * Simulated mode returns realistic, deterministic mock data with a small
 * artificial delay, and every call is written to IgotSyncLog so the
 * "synced" UI badges and the admin view are backed by a real audit trail
 * rather than a hardcoded string. Swapping to a live sandbox is then just
 * setting the two env vars and replacing the request bodies below with the
 * upstream API's actual contract.
 */

const BASE_URL = process.env.IGOT_API_BASE_URL;
const API_KEY = process.env.IGOT_API_KEY;
export const IGOT_LIVE = Boolean(BASE_URL && API_KEY);

async function log(kind: IgotLogKind, payload: unknown, userId?: string) {
  await prisma.igotSyncLog.create({
    data: { kind, userId, simulated: !IGOT_LIVE, payload: JSON.stringify(payload) },
  });
}

function simulatedDelay() {
  return new Promise((r) => setTimeout(r, 250 + Math.random() * 250));
}

export async function fetchCourseCatalog() {
  if (IGOT_LIVE) {
    const res = await fetch(`${BASE_URL}/course/v1/search`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const data = await res.json();
    await log("CATALOG_FETCH", { live: true, count: data?.result?.count ?? null });
    return data;
  }
  await simulatedDelay();
  await log("CATALOG_FETCH", { live: false, note: "simulated catalog pull - local Course table is the source of truth" });
  return { simulated: true, syncedAt: new Date().toISOString() };
}

export async function pushProgress(userId: string, courseId: string, progressPct: number) {
  if (IGOT_LIVE) {
    const res = await fetch(`${BASE_URL}/course/v1/progress/update`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ userId, courseId, progressPct }),
    });
    const data = await res.json();
    await log("PROGRESS_PUSH", { live: true, courseId, progressPct }, userId);
    return data;
  }
  await simulatedDelay();
  await log("PROGRESS_PUSH", { live: false, courseId, progressPct }, userId);
  return { simulated: true, accepted: true };
}

export async function syncCompetencyPassbook(
  userId: string,
  domainScores: { code: string; name: string; level: number }[]
) {
  if (IGOT_LIVE) {
    const res = await fetch(`${BASE_URL}/competency/v1/passbook/update`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ userId, domainScores }),
    });
    const data = await res.json();
    await log("PASSBOOK_SYNC", { live: true, domainScores }, userId);
    return data;
  }
  await simulatedDelay();
  await log("PASSBOOK_SYNC", { live: false, domainScores }, userId);
  return { simulated: true, accepted: true, syncedAt: new Date().toISOString() };
}

export async function publishQuizToKarmayogi(userId: string, documentId: string, questionIds: string[]) {
  if (IGOT_LIVE) {
    const res = await fetch(`${BASE_URL}/content/v1/assessment/create`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, questionIds }),
    });
    const data = await res.json();
    await log("QUIZ_PUBLISH", { live: true, documentId, count: questionIds.length }, userId);
    return data;
  }
  await simulatedDelay();
  await log("QUIZ_PUBLISH", { live: false, documentId, count: questionIds.length }, userId);
  return { simulated: true, published: questionIds.length, syncedAt: new Date().toISOString() };
}
