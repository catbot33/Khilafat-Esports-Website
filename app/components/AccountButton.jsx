"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export default function AccountButton() {
  const [label, setLabel] = useState("Sign up");

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      setLabel(data.user.user_metadata?.username || data.user.user_metadata?.full_name || "Account");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setLabel(session?.user?.user_metadata?.username || session?.user?.user_metadata?.full_name || (session ? "Account" : "Sign up"));
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return <Link className="signup-button" href="/signup">{label}</Link>;
}
