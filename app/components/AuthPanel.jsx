"use client";

import { useState } from "react";
import { createClient } from "../lib/supabase/client";

export default function AuthPanel({ initialMode = "signup", next = "/looking-for-player", currentUser = null }) {
  const [mode, setMode] = useState(initialMode);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitCredentials(event) {
    event.preventDefault();
    setSaving(true);
    setNotice("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const payload = mode === "signup"
      ? {
          username: formData.get("username"),
          email: formData.get("email"),
          password: formData.get("password"),
        }
      : {
          identifier: formData.get("identifier"),
          password: formData.get("password"),
        };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setNotice(result?.error || "Account request failed. Try again.");
      setSaving(false);
      return;
    }

    if (mode === "signup" && !result.signedIn) {
      setNotice(result.message);
      setSaving(false);
      form.reset();
      return;
    }

    window.location.assign(next);
  }

  async function continueWithGoogle() {
    setSaving(true);
    setNotice("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      setNotice(error.message);
      setSaving(false);
    }
  }

  async function signOut() {
    setSaving(true);
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.assign("/");
  }

  if (currentUser) {
    return (
      <div className="auth-signed-in">
        <span className="auth-avatar" aria-hidden="true">{currentUser.username.slice(0, 2)}</span>
        <p className="section-kicker">Player account</p>
        <h1>{currentUser.username}</h1>
        <p>Your invitations and join requests are saved to this account.</p>
        <div className="auth-account-actions">
          <a href="/looking-for-player">Open looking to play</a>
          <button type="button" onClick={signOut} disabled={saving}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-panel">
      <div className="auth-tabs" aria-label="Choose account action">
        <button type="button" className={mode === "signup" ? "is-active" : ""} onClick={() => { setMode("signup"); setNotice(""); }}>Create account</button>
        <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => { setMode("login"); setNotice(""); }}>Sign in</button>
      </div>

      <div className="auth-heading">
        <p className="section-kicker">Khilafat player ID</p>
        <h1>{mode === "signup" ? "Join the arena" : "Welcome back"}</h1>
        <p>{mode === "signup" ? "Keep your invitations, requests and team activity connected to one account." : "Sign in to manage your invitations and pending requests."}</p>
      </div>

      <button className="google-auth-button" type="button" onClick={continueWithGoogle} disabled={saving}>
        <span aria-hidden="true">G</span>
        Continue with Google
      </button>

      <div className="auth-divider"><span>or</span></div>

      <form className="auth-form" onSubmit={submitCredentials}>
        {mode === "signup" ? (
          <>
            <label>
              <span>Username</span>
              <input name="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_.-]+" autoComplete="username" placeholder="raven.khi" required />
            </label>
            <label>
              <span>Email</span>
              <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
            </label>
          </>
        ) : (
          <label>
            <span>Username or email</span>
            <input name="identifier" autoComplete="username" placeholder="raven.khi" required />
          </label>
        )}

        <label>
          <span>Password</span>
          <input name="password" type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="At least 8 characters" required />
        </label>

        {notice && <p className="auth-notice" role="status">{notice}</p>}

        <button className="auth-submit" type="submit" disabled={saving}>
          {saving ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          <span aria-hidden="true">→</span>
        </button>
      </form>
    </div>
  );
}
