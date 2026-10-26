# ZBlock — secure GitHub Pages shop starter

ZBlock is a static HTML/CSS/JavaScript storefront. This version is prepared to use Supabase for shared product inventory and owner-only product changes, while GitHub Pages hosts the public website.

## Files
- `index.html` — customer-facing storefront only; no owner login or dashboard controls
- `owner.html` — separate owner tools page, not linked from the storefront
- `owner.js` — owner authentication, product creation, stock edits, and product removal
- `style.css` — storefront styling
- `script.js` — product browsing, detail pages, variants, order enquiry, Supabase integration
- `supabase-config.js` — public Supabase project URL and publishable/anon key placeholders
- `supabase-setup.sql` — database tables, grants, and Row Level Security policies
- `SETUP-SUPABASE.md` — setup and deployment instructions

## Before publishing
1. Follow `SETUP-SUPABASE.md` completely.
2. Create your own owner account manually in Supabase Auth and insert only that account's UUID into `public.admin_users`.
3. Put only the Supabase project URL and public publishable/anon key in `supabase-config.js`. **Never put a service-role/secret key in browser files or GitHub.**
4. Test signed-out browsing, owner login, and denied write attempts before sharing the site.
5. Keep the product logo/image assets in their referenced paths. If you don't have the referenced `Images/Smiling LEGO Head with Curtain Hair.png` file in your local project, add it or update the image path in `index.html` before publishing.

## Security model
The owner tools live at a separate `owner.html` URL and are not linked from the customer storefront. This separation keeps the sign-in interface out of the normal shopping experience, but the URL itself is not a security boundary. Supabase Auth and Row Level Security (RLS) protect the data and write actions. Public visitors can read products. Only user IDs explicitly listed in `admin_users` can add, edit, or delete products. Do not add an open registration flow for owner accounts.

## Limitations
- Orders remain contact enquiries; this starter does not save orders or process payments.
- Product images are entered as image URLs; uploads are not implemented.
- Shared variant stock is saved to the database. It does not atomically reserve inventory when multiple customers try to order the last item simultaneously; add a server-side order/reservation function before relying on it for high-volume sales.
- Supabase must be configured before online inventory and login work. With placeholder config, the page shows fictional demo products in read-only mode.
