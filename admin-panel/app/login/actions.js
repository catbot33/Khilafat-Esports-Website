"use server";

import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";

export async function login(_previousState, formData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { message: "Enter both your email address and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { message: "The email address or password is incorrect." };
  }

  const { data: membership } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!membership) {
    await supabase.auth.signOut();
    return { message: "This account has not been granted administrator access." };
  }

  redirect("/");
}
