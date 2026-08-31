import { NextRequest, NextResponse } from "next/server";
import { db, unwrap } from "@/lib/db";
import { newId } from "@/lib/id";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import type { UserRow } from "@/lib/schema";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, employeeId, password, role, office, reportingOfficerId } = parsed.data;

  const [{ data: existing }, { data: officer }] = await Promise.all([
    db.from("User").select("id").eq("employeeId", employeeId).maybeSingle(),
    reportingOfficerId
      ? db.from("User").select("id").eq("id", reportingOfficerId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (existing) {
    return NextResponse.json({ error: "That Employee ID is already registered" }, { status: 409 });
  }
  if (reportingOfficerId && !officer) {
    return NextResponse.json({ error: "Selected reporting officer not found" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const user: UserRow = unwrap(
    await db
      .from("User")
      .insert({ id: newId(), name, employeeId, passwordHash, role, office, reportingOfficerId })
      .select()
      .single()
  );

  await setSessionCookie(user.id);
  return NextResponse.json({ ok: true });
}
