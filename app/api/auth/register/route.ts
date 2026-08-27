import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, employeeId, password, role, office } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { employeeId } });
  if (existing) {
    return NextResponse.json({ error: "That Employee ID is already registered" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, employeeId, passwordHash, role, office },
  });

  await setSessionCookie(user.id);
  return NextResponse.json({ ok: true });
}
