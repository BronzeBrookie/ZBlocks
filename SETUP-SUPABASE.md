# ZBlock: secure GitHub Pages + Supabase setup

This version keeps the storefront public and uses Supabase Auth + PostgreSQL Row Level Security (RLS) to protect the owner dashboard and shared inventory.

## Important security rules

- Never put a Supabase `service_role` or secret key in browser files or GitHub.
- `supabase-config.js` should contain only your project URL and the public publishable key (or legacy anon key).
- The storefront contains no owner sign-in or dashboard controls. The separate `owner.html` page is not linked from the storefront, but its URL is not a security boundary; the actual protection is the RLS policy in `supabase-setup.sql`.
- Do not enable public account sign-ups for this owner-only dashboard. Create your owner account manually in the Supabase dashboard.

## 1. Create your Supabase project

1. Create a project at https://supabase.com/ and keep your database password private.
2. In Project Settings / API (or Connect, depending on dashboard layout), copy the Project URL and the public publishable key. A legacy `anon` key is also designed for browser use. Do **not** copy a `service_role` or secret key.
3. Open SQL Editor, paste all of `supabase-setup.sql`, and run it.

## 2. Create the owner account

1. In Supabase Dashboard, open Authentication -> Users and create your account using your own email and a strong unique password. Do not add a public sign-up form to the website.
2. Copy the user's UUID from the Auth users list.
3. In SQL Editor, run this statement after replacing the placeholder with that UUID:

```sql
insert into public.admin_users (user_id)
values ('PASTE-YOUR-AUTH-USER-UUID-HERE');
```

Only accounts with a row in `admin_users` can write to `products`. Do not give anyone else an admin row.

## 3. Configure the website

1. Open `supabase-config.js`.
2. Replace `https://YOUR_PROJECT_REF.supabase.co` with your Project URL.
3. Replace `PASTE_YOUR_PUBLISHABLE_OR_LEGACY_ANON_KEY_HERE` with the public publishable/anon key.
4. Save the file. These two values are public browser config; the service-role key is not.

## 4. Add sample products

The database starts empty. Open `owner.html` directly on your local site to sign in and add your real products, or add rows through Supabase Table Editor. The customer-facing `index.html` has no sign-in form or owner dashboard link. Product descriptions, gallery URLs, and colour variants are stored in the shared database.

## 5. Test security before publishing

- Public storefront: products should be visible and there should be no owner sign-in or dashboard link anywhere on the page.
- Open `owner.html` directly: signed-out visitors should see the sign-in form, but no product-management controls.
- Signed in as your approved owner account: product and variant stock edits should save and appear after refresh/on other devices.
- A different account not listed in `admin_users`: sign-in may succeed if you created it manually, but it must not gain owner controls or be able to write to products.
- Try product writes only with the app's public key; RLS should reject unapproved users.

## 6. Configure Supabase Auth for your site

In Supabase Authentication URL configuration, set the Site URL to your GitHub Pages address once known, for example `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`. Add the same address to the allowed redirect URLs if you later use email links or OAuth. Exact dashboard labels may change.

## 7. Publish to GitHub Pages

1. Create a GitHub repository for the site.
2. Upload `index.html`, `owner.html`, `style.css`, `script.js`, `owner.js`, `supabase-config.js`, and your logo/image assets while preserving their folder names. `supabase-setup.sql` and this guide can also be kept in the repo, but don't put private credentials in it.
3. In repository Settings -> Pages, choose publishing from your `main` branch and the root folder (or configure a workflow).
4. Wait for deployment and test the published `github.io` URL. Enable HTTPS if the option is shown.

## Limitations in this starter

- Orders are still contact enquiries, not recorded orders or payments.
- Product image entry uses image URLs; it is not an image-upload/storage manager.
- Products and stock are shared online. Variant stock updates are protected by RLS, but two customers ordering the last unit at the same time are not atomically reserving stock. Add a server-side order/reservation function before relying on it for high-volume sales.
- This starter has not been tested against your live Supabase project because you need to create that project and add its public config first.
