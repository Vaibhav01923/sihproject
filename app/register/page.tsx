import { db } from "@/lib/db";
import RegisterForm from "./RegisterForm";

// This page has no cookies()/auth call to make Next infer it's dynamic (unlike
// every other db-fetching page in the app, which all sit behind getCurrentUser()).
// Without forcing it, Next statically prerenders it once at build time and the
// officer list - and new employee IDs registered since - would go stale.
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  // Fetched once here (server-side) so the Reporting Officer picker can
  // filter client-side by office with no extra round trip - same
  // server-fetch-then-prop-drill pattern used by app/(app)/studio/page.tsx.
  const { data: officersData } = await db
    .from("User")
    .select("id, name, employeeId, office")
    .order("name", { ascending: true });

  return <RegisterForm officers={officersData ?? []} />;
}
