# GearRent — connected to Supabase

This project now talks to a real Postgres database via [Supabase](https://supabase.com) instead of `localStorage`.

## Project layout

| Folder | What's in it |
|---|---|
| `src/pages/` | One file per page (Catalog, Cart, Memberships, Support, ...) with its CSS |
| `src/admin/` | The admin dashboard pages |
| `src/components/` | Shared pieces: Navbar, Footer, ProductCard, ImageDropzone, ... |
| `src/context/` | Shared app state: signed-in user, cart, categories, gear catalog, notifications |
| `src/lib/` | Helpers: Supabase client, prices and tiers (`pricing.js`), tier checks, image storage, rate limits |
| `public/` | Files served as-is, such as the tab icon (`favicon.png`) |
| `supabase/` | Every SQL file to run in the Supabase SQL Editor (order below) |

## Setup

All SQL files mentioned below are in the `supabase/` folder.

1. **Create the schema.** In your Supabase project's SQL Editor, run these two files in order (from the chat where this project was generated — ⚠️ **they are not in this repository yet**; see *Recovering the base schema* below):
   - `gearrent_supabase_schema.sql` — tables, RLS policies, auth trigger
   - `gearrent_supabase_schema_part2_seed.sql` — fixes id column types to match the app's slug-style ids, adds profile columns (`email`, `phone`, `address`, ...), adds the `credit_user_balance` RPC, and seeds categories/products/membership tiers from the original `mockData.js`
2. **Copy `.env.example` to `.env`** and fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from Project Settings → API.
3. **Run `gearrent_supabase_storage_setup.sql`** to create the `gear-images` Storage bucket and its RLS policies — this is required for the drag & drop photo uploader in Admin → Add Equipment and Provider Gear to work.
4. **Turn off "Confirm email"** in Authentication → Settings (or leave it on and handle the "check your email" step — the app already shows a message for this, but sign-up won't auto-log-in until the email is confirmed).
5. **Run `gearrent_security_update.sql`** (after the three files above) — roles, product approval, session revocation and rate limits. Then make yourself the first admin in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
   Every admin after that is created from **Admin Dashboard → Admin Accounts**.
6. **Run `gearrent_payments_update.sql`** (after step 5) — moves checkout, refunds, withdrawals and provider payouts into the database.
7. **Run `gearrent_notifications_update.sql`** (after step 6) — due-rental alerts, links on notifications, and upload rules for photos.
   *Optional:* enable the `pg_cron` extension and run the `cron.schedule(...)` line at the bottom of section 3 of that file, so due/overdue alerts are created even when nobody has the app open.
8. **Run `gearrent_integrity_update.sql`** (after step 7) — Gear Provider membership can only be bought (not self-assigned), only providers can list gear, a product can't be rented twice at once, and the admin dashboard data.
9. **Run `gearrent_returns_update.sql`** (after step 8) — renters request a return, the gear owner (or an admin) inspects it and confirms; late fees and damage come out of the deposit. See *Returns and deposits*.
10. **Run `gearrent_default_admin.sql`** (after step 5; re-run it if you ever re-run step 5) — makes the default admin account permanent.
11. **Run `gearrent_categories_update.sql`** (after step 5) — categories (name, tagline, cover image, order) are read from `public.categories` and managed on **Admin → Categories**; a category with products can't be deleted.
12. **Run `gearrent_membership_tiers_update.sql`** (after step 8) — three tiers: Gear Rent Guest (free, browse only), Gear Rent Renter (₱499) and Gear Rent Provider (₱699, or ₱199 for Renters). Existing providers become Gear Rent Provider; everyone else becomes Gear Rent Guest. See *Memberships and bookings*.
13. `npm install && npm run dev`.

## Returns and deposits

| Step | Who | What happens |
|---|---|---|
| Return gear | Renter (My Gears) | `request_rental_return()` tells the owner the renter says the gear is back. It doesn't affect the price. The rental stays active and the product stays booked; due/overdue alerts stop. |
| Inspect & confirm | Provider (Provider Gear → *Returned gear to check*) for their gear; admins (Admin → Returns) for Gear Rent's gear or any rental | `confirm_rental_return()` records when the gear actually came back (default now, can't be in the future or before the rental started), closes the rental and settles the money. Overdue rentals also show up here, so a provider can close one even if the renter never pressed *Return gear*. |

- **Late fee:** daily rate × days late, counted up to the time the owner enters when confirming. After the 1-hour grace period, any part of a day counts as a full day.
- **Damage:** amount entered by the inspector, with a required reason that the renter sees.
- Both come out of the security deposit only (late fee first) and are capped at it; the rest of the deposit is refunded. What is kept goes to the provider, or stays with Gear Rent for its own gear.
- `deposit_status` ends as `refunded` (all back), `partially_kept` or `kept` (nothing back).
- Early returns still refund the unused days (paid by Gear Rent — see *Known limitations*).
- `return_rental()` / `finish_rental()` can no longer be called from the app.

## Recovering the base schema

The two base files from step 1 were never saved into this project, so the database can't be rebuilt from the repo alone. Your live Supabase project still has everything, so export it once and commit the result:

1. Install the **PostgreSQL 17+ command-line tools** (EnterpriseDB Windows installer → tick only *Command Line Tools*).
2. In the Supabase dashboard: **Connect → Session pooler** for the connection string; the database password is under **Project Settings → Database** (reset it if unknown — the app uses the anon key, so this doesn't affect it).
3. Dump the schema:
   ```powershell
   & "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" "<session-pooler-connection-string>" --schema-only --schema=public --no-owner -f supabase_schema_dump.sql
   ```
4. The sign-up trigger lives on `auth.users`, so it isn't in that dump. Get it from the SQL Editor and append it to the file:
   ```sql
   select pg_get_triggerdef(oid) || ';' from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
   ```
5. Optional — seed data: same command with `--data-only --table=public.categories --table=public.products -f supabase_seed_dump.sql`.

(`npx supabase db dump` also works, but needs Docker Desktop.)

Or copy the original two files from the chat where they were generated.

## Memberships and bookings

| Rule | How it works |
|---|---|
| Three tiers | `profiles.tier` is one of `Gear Rent Guest` (level 0, the default), `Gear Rent Renter` (1) or `Gear Rent Provider` (2). Each tier includes the ones below it (`gearrent_tier_level()` / `getTierLevel()`). |
| Paid tiers must be paid for | Members can't change their own tier from the browser in either direction (trigger). The Memberships page shows a card form and calls `purchase_membership('renter' \| 'provider')`. It charges ₱499 for Renter and ₱699 for Provider, or ₱199 when a Renter upgrades. The payment goes into `membership_payments` (1-month period) and the account is upgraded. |
| Admins can set any tier | **Admin → Members →** (a member) **→ Membership** calls `admin_set_user_tier()`, which only admins can run. No payment is recorded, and the member gets a notification. |
| Only Renters and Providers rent | Adding to `cart_items` and creating `rentals` require level 1+ (admins exempt). Guests see a "View Memberships" button on product pages instead of "Rent Now". |
| Only providers list gear | Inserting into `products` requires a provider tier (admins exempt). |
| No double-booking | A rental can't be created for a product that already has an active rental (trigger + partial unique index). `products.status` switches to `booked` on checkout and back to `available` on return/finish, so the catalog shows "Booked". |
| Admin dashboard | All admin analytics pages read `admin_dashboard_snapshot()` (admin-only) and refresh every 30 s. |

The membership card form is still a simulation, and the monthly period isn't enforced yet (nothing downgrades an expired membership).

## Notification toasts

New notifications pop up as toasts in the bottom-right corner (they also stay in the bell panel, where items are now clickable):

| Who | When | Goes to |
|---|---|---|
| Admins | A provider submits a listing (or edits one back into review) | Admin → Approvals |
| Admins | A rental becomes overdue | Admin → Rental History |
| Renter | Their rental is due back within 24 hours, and again if it becomes overdue | My Gears |
| Provider | Their gear is due back within 24 hours / overdue | Provider Gear |
| Provider | Listing approved or rejected, gear rented | — |

The app checks every 15 seconds and whenever the tab regains focus (`gearrent_check_due_rentals()`); each alert is sent only once per rental. Results of your own actions (payment, return, withdrawal) are shown on the page instead of as a toast.

## Photo uploads

Photos are uploaded to the `gear-images` Supabase Storage bucket and the `products.images` column stores their URLs.
- Only JPG, PNG, WebP, GIF and AVIF up to 8MB (enforced by the bucket itself; SVG is refused because it can carry scripts).
- Providers' listings may only use photos from their own folder in that bucket — pasted outside links are rejected by the database.
- Removing a photo in the uploader, or deleting a listing, also deletes the files from Storage.
- If some photos in a batch fail, the ones that uploaded are kept and you're told how many failed.

## Server-side payments

All money now moves inside Postgres functions; the browser only asks for an action and shows the result.

| Action | Function | What the server decides |
|---|---|---|
| Pay for cart | `checkout_cart()` | Prices from `products` (not the browser), deposit, ₱500 service fee, availability/approval checks, blocks renting your own listing, credits providers, empties the cart |
| Return early | `return_rental(id)` | Unused days × the rate actually paid + deposit; can't be refunded twice |
| Finish rental | `finish_rental(id)` | Deposit refund |
| Withdraw | `request_withdrawal(amount)` | Balance check with a row lock (no double-spend), max 2 decimals, 5 per hour |

- Every balance change is written to `balance_transactions` (users can read their own; admins can read all).
- `profiles.balance` can't be written from the browser, rentals can't be inserted or edited directly (only `hidden_at` for "remove from history"), and the old `credit_user_balance` function is revoked for app users.
- Cart lengths are limited to 1–90 days.
- Pricing rules are unchanged from the original app. They live in `gearrent_security_deposit()` / `gearrent_service_fee()`; the matching numbers in `CartContext` are for display only.
- The card form is still a simulation. When a real payment provider is added, `checkout_cart` should run after the provider confirms payment (e.g. from its webhook), not directly from the page.

## Security & moderation update

| Requirement | How it works |
|---|---|
| Sign-out redirects to Sign-In | Every sign-out path (button, other tab, revoked session, idle timeout) goes through one function in `AuthContext` that clears state and `navigate('/signin', { replace: true })`, with a banner explaining why. |
| Sign out everywhere | **Sign Out** calls `supabase.auth.signOut({ scope: 'global' })`, which revokes every refresh token/session for the account. Other tabs react instantly (BroadcastChannel + `storage` event); other browsers/devices are caught by a server check (`auth.getUser()`) every 60 s and whenever the tab regains focus. |
| Tokens invalid after sign-out, Back button can't get in | The migration adds a RESTRICTIVE RLS policy to every table (and Storage) that requires the JWT's `session_id` to still exist in `auth.sessions` — a signed-out access token gets no data even before it expires. Route guards wait for the session check, redirect to `/signin`, and pages restored from the back/forward cache are re-validated. |
| Only admins create admins | `profiles.role` can no longer be changed by the user (trigger). The **Admin Accounts** page (admin-only route) creates a new admin login or promotes an existing account via `admin_set_user_role`, which re-checks that the caller is an admin, refuses to remove the last admin or yourself, and is rate-limited. |
| Listings need approval | New provider listings are stored as `pending` (enforced by a trigger, not the client) and hidden by RLS from everyone but the owner and admins. Admins approve/reject in **Admin Dashboard → Approvals** (reason required for rejections); the provider gets a notification. Editing an approved listing's content sends it back to review. Listings an admin adds are approved immediately. |
| Session tokens | PKCE OAuth flow; dedicated storage key; **Maintain Session** now works — when unchecked, the session ends when the browser is closed and after 30 min of inactivity. |
| Rate limits | Sign-in: 5 failures → 30 s lock, doubling up to 15 min; handles Supabase 429s. Sign-up: throttled per browser, 8-char minimum password. Server-side: 10 listing submissions/hour per provider, 20 role changes/hour per admin. |

### Recommended Supabase dashboard settings
- **Authentication → Sessions**: lower *JWT expiry* to 600–900 s; enable *Detect and revoke potentially compromised refresh tokens*.
- **Authentication → Rate Limits**: review sign-in / sign-up / token-refresh limits (these are the real server-side brute-force protection).
- **Authentication → Attack Protection**: consider enabling CAPTCHA (hCaptcha / Turnstile) for sign-in and sign-up.
- If you add tables later, re-run section 3 of `gearrent_security_update.sql` so they get the active-session policy too.

> Note: the Supabase client now stores its session under the key `gearrent-auth`, so anyone signed in before this update will be asked to sign in once more.

### What changed
- `AuthContext`, `CartContext`, `ProviderContext`, `NotificationContext` now read/write Supabase instead of `localStorage`/`sessionStorage`. Their exposed function names are unchanged, but mutating calls (`authenticate`, `createAccount`, `addItem`, `returnRental`, etc.) are now `async` — callers that branch on the return value use `await`; the rest fire-and-forget, same as before.
- Passwords are handled entirely by Supabase Auth now — nothing is stored or compared in plaintext.
- `src/lib/pricing.js` (formerly `src/mockData.js`) holds `membershipTiers`, the `formatPeso` / `calculateSecurityDeposit` helpers, and display copies of the service and provider fees. Products and categories come from the database (the original sample products were seeded from an earlier version of this file).

### Known limitations (carried over from the migration report)
- ~~Checkout pricing is computed client-side~~ — fixed, see *Server-side payments*.
- Business rules worth a decision: an early return refunds unused days from Gear Rent's side while the provider keeps the full payout; the "10% off" Gear Renter perk is advertised but not applied. (~~₱499 fee not charged~~ and ~~double-booking~~ — fixed, see *Memberships and bookings*.)
- ~~The admin dashboard has no real admin login~~ — fixed. `/admin/*` requires `profiles.role = 'admin'`, and the role can only be granted by another admin.
- ~~Several admin analytics pages still read legacy `localStorage` data~~ — fixed, they read `admin_dashboard_snapshot()`.
- ~~Provider-uploaded photos are stored as base64 data URLs~~ — fixed. Both Admin → Add Equipment and Provider Gear now use a shared drag & drop uploader (`src/components/ImageDropzone.jsx`) that uploads files straight to the `gear-images` Supabase Storage bucket and stores the resulting public URLs in the `images` column. Run `gearrent_supabase_storage_setup.sql` to create the bucket before using these forms.

