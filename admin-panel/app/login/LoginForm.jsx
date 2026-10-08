"use client";

import { useActionState } from "react";
import { login } from "./actions";

const initialState = { message: "" };

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form className="login-form" action={formAction}>
      <label>
        <span>Email address</span>
        <input name="email" type="email" autoComplete="email" placeholder="admin@khilafat.gg" required />
      </label>

      <label>
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required />
      </label>

      {state.message && <p className="login-error" role="alert">{state.message}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Checking access…" : "Enter control panel"}
        <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
