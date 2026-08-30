import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import type { UserRow } from "@/lib/schema";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { employeeId, password } = parsed.data;

  const { data: user } = await db.from("User").select("*").eq("employeeId", employeeId).maybeSingle();
  if (!user || !(await verifyPassword(password, (user as UserRow).passwordHash))) {
    return NextResponse.json({ error: "Incorrect Employee ID or password" }, { status: 401 });
  }

  await setSessionCookie((user as UserRow).id);
  return NextResponse.json({ ok: true });
}
