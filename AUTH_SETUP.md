# Player account setup

The public website uses Supabase Auth and the same Supabase database as the admin panel.

## 1. Apply the database migration

Open the Supabase SQL Editor, paste the complete contents of:

`admin-panel/supabase/migrations/20261003_create_player_accounts_and_invitations.sql`

Run it once. It creates player profiles, saved invitations, join requests, triggers, indexes, and row-level security policies.

## 2. Complete `.env.local`

Keep the existing public URL and publishable key, then add:

```env
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Find the service-role key in Supabase Dashboard under **Project Settings → API Keys**. It is server-only: never prefix it with `NEXT_PUBLIC_`, commit it, or expose it in browser code.

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` placeholders are included in `.env.local` for local reference, but the hosted Supabase project reads these credentials from its Google provider settings, not from the Next.js process.

## 3. Configure Google Cloud

Create a **Web application** OAuth client.

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `https://aeicfcmtxpxbmywuqihp.supabase.co/auth/v1/callback`

## 4. Configure Supabase Auth

In **Authentication → Sign In / Providers → Google**:

- Enable Google.
- Paste the Google Client ID.
- Paste the Google Client Secret.

In **Authentication → URL Configuration**:

- Site URL: `http://localhost:3000`
- Additional redirect URL for local development: `http://localhost:3000/**`

Restart `npm run dev` after changing `.env.local`.

When deploying, replace the localhost Site URL/origin and add the production `/auth/callback` URL to Supabase's redirect allow list. The Google redirect URI remains the Supabase project callback shown above.
