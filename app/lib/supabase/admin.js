import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!projectUrl || !serviceRoleKey) return null;

  return createClient(projectUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
