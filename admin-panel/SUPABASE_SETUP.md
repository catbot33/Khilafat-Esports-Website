# Supabase connection checklist

The admin panel and public Khilafat Esports website should use the same Supabase project. They remain separate websites and deployments; only their database connection is shared.

## 1. Create the project and schema

1. Create a Supabase project.
2. Open **SQL Editor** in the Supabase dashboard.
3. Paste and run `supabase/schema.sql` from this admin project.
4. Confirm that `public.tournaments` and `public.admin_users` were created.
5. Confirm that Storage contains the public `tournament-images` bucket.

## 2. Create the first administrator

1. Open **Authentication > Users**.
2. Create the administrator using an email address and a strong password.
3. Copy that user's UUID.
4. Run this in SQL Editor, replacing the placeholder:

```sql
insert into public.admin_users (user_id)
values ('PASTE_AUTH_USER_UUID_HERE');
```

Only users listed in `admin_users` can create, update, or delete tournaments.

## 3. Add the connection values

Open the Supabase project's **Connect** panel and copy the Project URL and Publishable key. Create `admin-panel/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

The public website will use the same two values in its own `.env.local`. The publishable key is safe to use in browser code because Row Level Security controls access.

Never put a secret key or service-role key in a `NEXT_PUBLIC_` variable, commit it, or expose it to the browser.

## 4. What happens after connection

- The admin site signs administrators in with Supabase Auth.
- Authenticated administrators can manage all tournament rows.
- Anonymous visitors to the public site can read only rows whose visibility is `Published`.
- Drafts stay invisible on the public site.
- Tournament artwork is uploaded to the shared `tournament-images` bucket.
- Both websites receive the same records while remaining independently deployed.

## Valorant form update

If the original schema was already installed, run `supabase/migrations/20261002_add_tournament_details.sql` once in the SQL Editor. It adds the `description` and `region_server` fields required by the Valorant tournament form.

Then run `supabase/migrations/20261002_add_valorant_variant_and_map.sql` once. It adds the Valorant variant and map fields.

Alternatively, run `supabase/migrations/20261002_complete_tournament_fields.sql` once to add all four fields in a single safe migration. This is the recommended option when the dashboard reports a schema-cache error.

Run `supabase/migrations/20261002_create_tournament_registrations.sql` to enable Valorant team submissions from each public tournament details page.

## Live tournament engine

Run `supabase/migrations/20261005_create_live_tournament_engine.sql` once in the SQL Editor. It creates the persisted bracket, selected-team, score, and standings state used by the **Live scores** control-panel tab and the public homepage.

For local development, the admin panel connects to the public Socket.IO server at `http://localhost:3000`. For separate deployments, set:

```env
# admin panel
NEXT_PUBLIC_MAIN_SITE_URL=https://YOUR_PUBLIC_SITE

# public website (comma-separated allowed browser origins)
SOCKET_IO_ORIGINS=https://YOUR_PUBLIC_SITE,https://YOUR_ADMIN_PANEL
```
