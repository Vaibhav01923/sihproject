import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { getOrCreateAttempt } from "@/lib/assessment";

export async function POST() {
  try {
    const user = await requireUser();
    await getOrCreateAttempt(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    throw e;
  }
}
