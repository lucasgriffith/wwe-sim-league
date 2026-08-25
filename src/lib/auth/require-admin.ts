import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Admin access is allowlist-based: ADMIN_EMAILS is a comma-separated list of
 * emails permitted to perform writes. Fails closed — if the env var is unset,
 * nobody is an admin. Being logged in is NOT enough: Supabase self-signup
 * would otherwise let any visitor create an account and gain write access.
 */
export function isAdminUser(user: User | null): boolean {
  if (!user?.email) return false;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(user.email.toLowerCase());
}

export async function requireAdmin(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminUser(user)) throw new Error("Unauthorized");
  return user!;
}
