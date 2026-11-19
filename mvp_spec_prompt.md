# MASTER BUILD PROMPT: Tunisian Teacher-to-Teacher Digital Marketplace (MVP)

> **Instructions for AI Coding Assistant:**
> Build a complete, production-ready MVP for a Tunisian Teacher-to-Teacher digital marketplace (courses, *joudhadhet*, *devoirs*, *séries*).
> Write all code, identifiers, database schemas, and comments in **English**.
> UI copy must support **Arabic (RTL)** and **French** curriculum terms cleanly.
> Implement every constraint, security rule, API contract, forensic watermark layer, and edge case below strictly without skipping any detail.

## 1. Core Business Model & Product Constraints

1. **No Online Payment Gateway:** Buyers pay sellers directly off-platform (D17, Flouci, cash).

2. **No Buyer Login:** Buyers browse, search, view watermarked preview images, click WhatsApp, and redeem download codes **without creating an account**.

3. **Seller-Only Authentication:** Only Sellers and Admins log in.

4. **Monetization (Pre-Paid Code Packs + Listing Boosts):**

   * Sellers receive **5 free starter download codes** upon registration.

   * Generating a download code deducts `1` from `seller_profiles.code_balance`.

   * Sellers buy **Code Packs** (e.g., 15 codes / 15 TND, 50 codes / 35 TND, 100 codes / 50 TND) or **Listing Boosts** (7, 14, or 30 days) by transferring via D17 / Flouci / RIB and submitting a top-up request with their receipt reference. Admin approves it manually.

5. **Anti-Piracy & Invisible Forensic Watermarking:**

   * **Public Preview Images (Visible Watermark):** The 1–4 preview images on the listing page have a **visible** diagonal watermark (`3alamni.tn | /s/{slug}`) to prevent free screenshotting before purchase.

   * **Downloaded Full PDF (Invisible Forensic Watermark):** When a buyer pays and enters their `code` + `buyer_phone`, the downloaded PDF must **NOT** have an ugly visible watermark that ruins reading or printing. Instead, embed a **3-layer invisible forensic watermark** (hidden text + HMAC metadata + ultra-faint screenshot-recoverable layer) tied to `buyer_phone` + `code`.

   * **Leak Detector:** Sellers/Admins can upload a leaked PDF or screenshot to `POST /api/seller/leak-check` to extract the leaker's `buyer_phone` automatically.

6. **Tunisian 4G Edge Case:** Do NOT burn a code on the first byte. Allow up to **3 downloads** (`max_downloads = 3`) within **24 hours** of `first_used_at` for the same `code` + `buyer_phone` so dropped mobile connections don't break delivery.

7. **Seller Growth Hooks:**

   * Dedicated **Seller Storefront** (`/s/[slug]`) organized by grade & trimester.

   * **1-Click Facebook Post Generator**: formatted post text + downloadable watermarked preview images.

   * **Dynamic Open Graph Cards** (`/api/public/og/*`) so shared links render rich preview cards on Facebook.

   * **Concierge Onboarding**: Admin can pre-build a seller's store & listings before handing over credentials.

## 2. Tech Stack & Project Structure

* **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS) — RTL-ready, mobile-first for Tunisian 4G.

* **Backend:** NestJS (TypeScript) with `class-validator`, `class-transformer`, `helmet`, `@nestjs/throttler`, `@nestjs/schedule`.

* **Database & Cache:** PostgreSQL + Prisma (with `SELECT ... FOR UPDATE` row locking) + Redis (rate limiting, click deduplication).

* **Storage:** Cloudflare R2 (S3-compatible via `@aws-sdk/client-s3`):

  * `previews/` (public CDN): Visible-watermarked WebP preview images.

  * `private-pdfs/` (private bucket/prefix): Original unwatermarked PDFs (never publicly accessible).

* **File Processing:** `sharp` (WebP compression, visible preview watermarks, OG image generation, and leak-check contrast enhancement), `pdf-lib` (3-layer invisible PDF watermarking), `pdf-parse` (extracting hidden text/metadata on leak check), `file-type` (magic-bytes validation).

* **Bot Protection:** Cloudflare Turnstile on `/api/public/codes/redeem`, `/api/public/listings/:id/report`, and `/api/auth/register`.

* **Deployment:** Docker Compose (`frontend`, `backend`, `postgres`, `redis`, `nginx` with Let's Encrypt SSL).

## 3. Environment Variables (`.env.example`)

```
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://yourapp.tn

DATABASE_URL=postgresql://user:pass@postgres:5432/marketplace
REDIS_URL=redis://redis:6379

JWT_ACCESS_SECRET=change_me_64_chars
JWT_REFRESH_SECRET=change_me_64_chars
WATERMARK_HMAC_SECRET=change_me_64_chars

R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_PUBLIC_BUCKET=marketplace-previews
R2_PUBLIC_CDN_URL=https://cdn.yourapp.tn
R2_PRIVATE_BUCKET=marketplace-private-pdfs

TURNSTILE_SECRET_KEY=xxx
NEXT_PUBLIC_TURNSTILE_SITE_KEY=xxx

```

## 4. PostgreSQL Database Schema & Relations

```
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users (Sellers & Admins ONLY; buyers never have accounts)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,                 -- Argon2id or Bcrypt (cost >= 12)
  role VARCHAR(10) NOT NULL DEFAULT 'SELLER' CHECK (role IN ('SELLER', 'ADMIN')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Seller Profiles (1:1 with users)
CREATE TABLE seller_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug VARCHAR(60) UNIQUE NOT NULL,            -- URL-safe lowercase, e.g. 'prof-amine'
  display_name VARCHAR(100) NOT NULL,
  whatsapp VARCHAR(20) NOT NULL,               -- Normalized: '216XXXXXXXX'
  messenger_url TEXT,
  bio VARCHAR(300),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  code_balance INT NOT NULL DEFAULT 5 CHECK (code_balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Refresh Tokens (N:1 with users; supports rotation & reuse detection)
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL,                -- SHA-256 hex of refresh token
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- 4. Listings (N:1 with users)
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  cycle VARCHAR(20) NOT NULL CHECK (cycle IN ('primaire', 'college', 'lycee')),
  grade VARCHAR(40) NOT NULL,                  -- e.g. '5eme', 'bac-math'
  subject VARCHAR(60) NOT NULL,
  trimester SMALLINT CHECK (trimester IN (1, 2, 3)),
  material_type VARCHAR(20) NOT NULL CHECK (material_type IN ('joudhadha', 'devoir', 'serie', 'cours')),
  price_tnd NUMERIC(7,2) NOT NULL CHECK (price_tnd >= 0),
  preview_images TEXT[] NOT NULL,              -- 1 to 4 public WebP URLs (visible watermark)
  r2_pdf_key TEXT NOT NULL,                    -- Private R2 key, NEVER exposed publicly
  is_boosted BOOLEAN NOT NULL DEFAULT FALSE,
  boost_expires_at TIMESTAMPTZ,
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'HIDDEN')),
  contact_clicks INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_listings_search ON listings(status, is_boosted DESC, cycle, grade, subject, created_at DESC);
CREATE INDEX idx_listings_seller ON listings(seller_id, created_at DESC);

-- 5. Download Codes (N:1 with listings & users)
CREATE TABLE download_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(12) UNIQUE NOT NULL,            -- e.g. 'EDU-9K4M'
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_phone VARCHAR(20) NOT NULL,            -- Normalized: '216XXXXXXXX'
  buyer_note VARCHAR(100),                     -- Optional buyer name/note
  hmac_sig VARCHAR(32) NOT NULL,               -- Truncated HMAC-SHA256 for forensic verification
  download_count INT NOT NULL DEFAULT 0,
  max_downloads INT NOT NULL DEFAULT 3,
  first_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,                      -- Set to first_used_at + 24 hours on 1st download
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_codes_seller_phone ON download_codes(seller_id, buyer_phone);
CREATE INDEX idx_codes_code_lookup ON download_codes(code);

-- 6. Download Audit Logs (N:1 with download_codes)
CREATE TABLE download_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES download_codes(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  user_agent TEXT,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_download_logs_code ON download_logs(code_id, downloaded_at DESC);

-- 7. Code Pack & Boost Top-Ups (N:1 with users)
CREATE TABLE code_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topup_type VARCHAR(15) NOT NULL CHECK (topup_type IN ('CODE_PACK', 'BOOST')),
  pack_codes INT,                              -- Required if CODE_PACK
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL, -- Required if BOOST
  boost_days INT,                              -- e.g. 7, 14, 30
  amount_tnd NUMERIC(7,2) NOT NULL,
  payment_method VARCHAR(15) NOT NULL CHECK (payment_method IN ('D17', 'FLOUCI', 'RIB')),
  receipt_ref TEXT NOT NULL,                   -- Transaction reference or screenshot URL
  status VARCHAR(15) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Listing Reports (Public anti-spam / anti-piracy reporting)
CREATE TABLE listing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reason VARCHAR(40) NOT NULL CHECK (reason IN ('PIRACY', 'SCAM', 'WRONG_INFO')),
  details VARCHAR(400),
  reporter_ip INET NOT NULL,
  status VARCHAR(15) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

```

## 5. Security Architecture (Non-Negotiable Rules)

1. **JWT + HttpOnly Cookies (Zero `localStorage`):**

   * `access_token`: **15m** expiry, signed JWT (`{ sub: user.id, role: user.role }`), cookie flags: `HttpOnly; Secure; SameSite=Lax; Path=/`.

   * `refresh_token`: **7d** expiry, random 64-byte hex, cookie flags: `HttpOnly; Secure; SameSite=Lax; Path=/api/auth/refresh`. Store only `SHA-256` hash in `refresh_tokens`.

   * **Refresh Token Rotation & Reuse Detection:** Every `/api/auth/refresh` revokes the old token and issues a new pair. If a previously revoked `refresh_token` is submitted, immediately revoke ALL active `refresh_tokens` for that `user_id` and return `401`.

2. **CSRF Protection (Double-Submit Cookie Pattern):**

   * On login/register/refresh, set a readable cookie `csrf_token` (`HttpOnly: false; Secure; SameSite=Lax; Path=/`).

   * `CsrfGuard` runs on all state-changing authenticated routes (`POST`, `PATCH`, `DELETE`) and verifies `req.headers['x-csrf-token'] === req.cookies['csrf_token']` using `crypto.timingSafeEqual`.

3. **IDOR Prevention:**

   * Every `/api/seller/*` endpoint derives `sellerId` strictly from `req.user.sub`.

   * Before modifying/deleting a listing or revoking a code, assert `record.seller_id === req.user.sub`; otherwise throw `403 Forbidden`.

4. **File Upload Validation:**

   * Check **Magic Bytes** using `file-type` (`fromBuffer`) before processing. Reject if preview is not `image/jpeg|png|webp` (max 5 MB each, max 4 images) or document is not `application/pdf` (max 25 MB), or leak-check file is not PDF/image (max 25 MB).

5. **Rate Limiting & Bot Protection:**

   * `POST /api/public/codes/redeem`: Max **5 requests / 15 min per IP** + Cloudflare Turnstile verification.

   * `POST /api/auth/login` & `POST /api/auth/register`: Max **10 requests / 15 min per IP**.

   * `POST /api/public/listings/:id/report`: Max **3 reports / hour per IP**.

6. **HTTP Headers & CORS:**

   * Enable `helmet()`. Strict CORS: `{ origin: process.env.FRONTEND_URL, credentials: true }`.

## 6. Complete API Specification (What Each Endpoint Does, Does NOT Do & Error Codes)

### A. Public Endpoints (`/api/public/*` — No Auth Required)

* `GET /api/public/listings`

  * **Does:** Filters `status = 'ACTIVE'` by `cycle`, `grade`, `subject`, `trimester`, `material_type`, `q`, paginated (`page`, `limit <= 24`). Orders by `is_boosted DESC, created_at DESC`. Returns public seller info (`slug`, `display_name`, `is_verified`).

  * **Does NOT:** Never returns `r2_pdf_key`, `seller.email`, or `code_balance`.

* `GET /api/public/listings/:id`

  * **Does:** Returns full public listing details, `preview_images`, seller's `whatsapp`, `messenger_url`.

  * **Does NOT:** Never returns `r2_pdf_key` or `HIDDEN` listings (`404` if hidden).

* `GET /api/public/stores/:slug`

  * **Does:** Returns seller profile + all `ACTIVE` listings grouped/filterable by grade & trimester.

  * **Does NOT:** Never returns `code_balance`, `email`, or `download_codes`.

* `GET /api/public/og/listing/:id` & `GET /api/public/og/store/:slug`

  * **Does:** Dynamically generates and caches a `1200x630` PNG/WebP Open Graph card using `sharp` + SVG overlay (title, grade, price, verified badge) for Facebook group sharing.

* `POST /api/public/listings/:id/click`

  * **Does:** Deduplicates by `(listing_id, ip_address)` in Redis for 24h; increments `contact_clicks` by `1`.

  * **Does NOT:** Never blocks the user from opening WhatsApp if rate-limited.

* `POST /api/public/codes/redeem`

  * **Does:** Validates Turnstile + `{ code, buyerPhone, listingId }`. Normalizes `buyerPhone`. Verifies code exists, matches `listingId` & `buyer_phone`, `!is_revoked`, `download_count < max_downloads`, and (`expires_at IS NULL OR expires_at > NOW()`). Fetches PDF from private R2, calls `stampInvisibleWatermark()`, increments `download_count`, sets `first_used_at` & `expires_at = NOW() + 24h` on 1st use, inserts `download_logs`, and streams PDF with `Content-Disposition: attachment; filename="document.pdf"`.

  * **Does NOT:** Never modifies the original PDF in R2; never exposes the R2 signed URL.

  * **Errors:** `400` invalid phone/Turnstile, `404` invalid code/phone mismatch, `409` code revoked / max downloads (3) reached / 24h window expired, `429` rate limit exceeded.

* `POST /api/public/listings/:id/report`

  * **Does:** Validates Turnstile and records piracy/scam report in `listing_reports`.

  * **Does NOT:** Never auto-hides a listing without admin review.

### B. Auth Endpoints (`/api/auth/*`)

* `POST /api/auth/register`: Validates input + Turnstile, hashes password, creates `users` (`role = 'SELLER'`) + `seller_profiles` (`code_balance = 5`), sets auth + CSRF cookies. **Does NOT** accept `role` from body.

* `POST /api/auth/login`: Verifies password, sets `access_token`, `refresh_token`, `csrf_token` cookies.

* `POST /api/auth/refresh`: Validates `refresh_token` cookie against `refresh_tokens` hash, rotates token, issues new cookies.

* `POST /api/auth/logout`: Revokes current `refresh_token` in DB and clears all auth cookies.

* `GET /api/auth/me`: Returns current user + `seller_profile` (`code_balance`, `is_verified`, `slug`).

### C. Seller Endpoints (`/api/seller/*` — `JwtAuthGuard` + `CsrfGuard`)

* `GET /api/seller/dashboard`: Returns `code_balance`, total `contact_clicks`, total `codes_generated`, active listings count.

* `POST /api/seller/listings` (Multipart): Validates 1–4 preview images + 1 PDF -> `processPreviewImages()` -> `uploadPrivatePdf()` -> inserts listing. **Does NOT** allow setting `is_boosted` or `contact_clicks`.

* `PATCH /api/seller/listings/:id` & `DELETE /api/seller/listings/:id`: Updates/deletes listing ONLY if `seller_id === req.user.sub`. On delete, also deletes R2 objects.

* `GET /api/seller/listings/:id/fb-pack`: Returns pre-formatted Arabic/French Facebook post text (title, grade, trimester, price, storefront URL) + downloadable watermarked preview URLs.

* `POST /api/seller/codes`: Validates `{ listingId, buyerPhone, buyerNote }` -> runs `generateDownloadCode()` in DB transaction. **Errors:** `402` if `code_balance <= 0`, `403` if listing not owned by seller.

* `GET /api/seller/codes?phone=&listingId=`: Lists seller's generated codes with `buyer_phone`, `download_count`, `expires_at`, `is_revoked`, searchable by `buyer_phone` for leak tracing.

* `PATCH /api/seller/codes/:id/revoke`: Sets `is_revoked = true` if owned by seller. **Does NOT** refund `code_balance`.

* `POST /api/seller/leak-check` (Multipart): Accepts a leaked PDF or screenshot image -> runs `inspectLeakedFile()` to extract `buyerPhone` + `code` (from PDF metadata/hidden text) OR returns a high-contrast enhanced image (for screenshots). **Does NOT** store leaked files permanently.

* `POST /api/seller/topups` & `GET /api/seller/topups`: Submits/lists manual D17/Flouci/RIB top-up requests. **Does NOT** credit `code_balance` automatically.

### D. Admin Endpoints (`/api/admin/*` — `JwtAuthGuard` + `AdminGuard` + `CsrfGuard`)

* `POST /api/admin/concierge-seller`: Creates a seller account + profile + initial listings in one flow so admin can hand over a ready-made store.

* `GET /api/admin/topups?status=PENDING`: Lists pending D17/Flouci requests.

* `PATCH /api/admin/topups/:id/review`: Approves/rejects top-up inside a transaction (`APPROVED` increments `code_balance` or sets `is_boosted = true` + `boost_expires_at`).

* `PATCH /api/admin/sellers/:id/verify`: Toggles `is_verified`.

* `PATCH /api/admin/listings/:id/moderate`: Sets listing `status` (`ACTIVE` | `HIDDEN`).

* `GET /api/admin/reports?status=OPEN` & `PATCH /api/admin/reports/:id`: Lists and resolves listing reports.

## 7. Core Service Functions (Exact Behavior)

1. `normalizeTunisianPhone(input: string): string`

   * Strips spaces, dashes, `+`, and leading `00`. Validates 8-digit Tunisian mobile (`2|4|5|9` prefix or `216` + 8 digits) and returns `'216XXXXXXXX'`. Throws `400 Bad Request` on invalid format.

2. `processPreviewImages(files: Express.Multer.File[], sellerSlug: string): Promise<string[]>`

   * Checks magic bytes via `file-type`. Resizes each image to max width `1000px`, composites a **visible** semi-transparent diagonal SVG watermark (`3alamni.tn | /s/${sellerSlug}`), converts to `WebP` (quality 80), uploads to R2 `previews/`, returns public URLs.

3. `uploadPrivatePdf(file: Express.Multer.File, sellerId: string, listingId: string): Promise<string>`

   * Checks magic bytes (`application/pdf`). Uploads to private R2 key `private-pdfs/${sellerId}/${listingId}.pdf`. Never generates a public URL.

4. `generateDownloadCode(sellerId: string, listingId: string, buyerPhone: string, buyerNote?: string)`

   * Inside `prisma.$transaction`:

     * Locks seller row (`SELECT code_balance FROM seller_profiles WHERE user_id = $1 FOR UPDATE`).

     * Asserts `code_balance > 0` and listing ownership.

     * Decrements `code_balance` by `1`.

     * Generates cryptographically random code (`EDU-` + 4 uppercase alphanumeric chars excluding `O,0,I,1,L`).

     * Computes `hmac_sig = HMAC-SHA256(WATERMARK_HMAC_SECRET, `${code}:${buyerPhone}`).slice(0, 16)`.

     * Inserts into `download_codes`.

5. `stampInvisibleWatermark(pdfBuffer: Buffer, buyerPhone: string, code: string, hmacSig: string): Promise<Uint8Array>`

   * Loads PDF via `pdf-lib`, embeds `StandardFonts.Helvetica`.

   * **Layer 1 (Hidden Machine-Readable Text):** Draws `BUYER:${buyerPhone}|CODE:${code}|SIG:${hmacSig}` in pure white `rgb(1, 1, 1)` at `size: 2` in the bottom-left margin of every page (invisible to human eye/print, extracted instantly by `pdf-parse`).

   * **Layer 2 (Encrypted PDF Metadata):** Sets `pdfDoc.setSubject("LIC:" + Buffer.from(`${buyerPhone}|${code}\\vert{}\${hmacSig}`).toString('base64'))` and `pdfDoc.setKeywords([hmacSig, code])`.

   * **Layer 3 (Screenshot-Recoverable Forensic Layer):** Draws `${buyerPhone} - ${code}` diagonally in the center of every page using ultra-faint light gray `rgb(0.95, 0.95, 0.95)` at `opacity: 0.02`, `size: 20`, `rotate: degrees(35)` (invisible on white paper, recoverable when `sharp` boosts contrast on a leaked screenshot).

6. `inspectLeakedFile(file: Express.Multer.File)`

   * Checks magic bytes via `file-type`.

   * **If PDF:** Parses metadata (`Subject`/`Keywords`) and text via `pdf-parse` to extract `BUYER:<phone>|CODE:<code>|SIG:<hmac>`, verifies HMAC against `WATERMARK_HMAC_SECRET`, and returns `{ detected: true, buyerPhone, code, verified: true }`.

   * **If Image (Screenshot):** Enhances contrast using `sharp(file.buffer).greyscale().normalise().linear(4.5, -1.5).webp().toBuffer()` and returns `{ type: 'IMAGE_ENHANCED', enhancedImageBase64 }` so the seller can visually read the faint diagonal phone number & code.

7. `redeemAndStreamPdf(code: string, buyerPhone: string, ip: string, userAgent: string)`

   * Validates code + normalized `buyerPhone`, checks `is_revoked === false`, `download_count < max_downloads`, and 24h expiry window.

   * Downloads PDF buffer from private R2, calls `stampInvisibleWatermark()`, updates `download_count = download_count + 1` (and sets `first_used_at = NOW()`, `expires_at = NOW() + 24h` if null), inserts `download_logs`, and returns buffer.

## 8. Cron Jobs / Scheduled Maintenance

* **Hourly Boost Expiration Job:** Sets `is_boosted = false` where `is_boosted = true AND boost_expires_at < NOW()`.

* **Daily Token Cleanup Job:** Deletes `refresh_tokens` where `expires_at < NOW() - INTERVAL '7 days'`.

## 9. Frontend Pages (Next.js App Router)

1. `/` — Curriculum-filtered catalog (`cycle`, `grade`, `subject`, `trimester`, `material_type`), boosted cards first.

2. `/listings/[id]` — Watermarked preview gallery, price, verified badge, **"Contact on WhatsApp"** button (triggers `/click`), and **"I have a Download Code"** modal (inputs: `Code` + `Phone Number` + Turnstile -> triggers PDF download).

3. `/s/[slug]` — Seller Storefront organized by grade & trimester.

4. `/dashboard` — Seller portal: Listings CRUD, **1-Click Facebook Post Generator**, Code Generator (`buyerPhone` + `buyerNote`), **Leak Lookup & Leak Detector** (search by phone OR upload leaked PDF/screenshot), and **Top-Up / Boost** modal with D17/Flouci instructions.

5. `/admin` — Admin portal: Concierge seller creation, Top-Up approval queue, Verification toggles, and Reported listings moderation.

---

## 10. Mandatory Stack & Dockerized Repository Structure

You MUST use **Docker + Docker Compose**, **NestJS**, **Next.js**, and **PostgreSQL** with this exact folder structure:

```text
/
├── docker-compose.yml          # Services: frontend, backend, postgres, redis, nginx
├── .env.example
├── nginx/
│   └── default.conf            # Routes /api/* -> backend:4000, /* -> frontend:3000
├── backend/                    # NestJS + Prisma + PostgreSQL
│   ├── Dockerfile              # Multi-stage Node 20 Alpine build (includes sharp deps)
│   ├── prisma/schema.prisma
│   └── src/
│       ├── auth/               # JWT HttpOnly cookies + Refresh rotation + CsrfGuard
│       ├── public/             # Catalog, Storefront, OG cards, Code Redeem, Report
│       ├── seller/             # Listings CRUD, FB pack, Code Gen, Leak-Check, Topups
│       ├── admin/              # Concierge seller, Topup review, Verify, Moderate
│       ├── watermark/          # sharp (previews & screenshots) + pdf-lib/pdf-parse
│       ├── storage/            # Cloudflare R2 S3 client
│       └── cron/               # Boost expiration & token cleanup
└── frontend/                   # Next.js (App Router, TypeScript, Tailwind CSS)
    ├── Dockerfile              # Multi-stage standalone Next.js build
    └── src/app/
        ├── page.tsx            # Public curriculum catalog
        ├── listings/[id]/      # Listing detail + WhatsApp + Redeem modal
        ├── s/[slug]/           # Seller Storefront
        ├── dashboard/          # Seller portal + FB post generator + Leak Detector
        └── admin/              # Admin portal
```

### Docker Compose Requirements
- **`postgres` (`postgres:16-alpine`):** Persistent volume `pgdata`, healthcheck (`pg_isready`), initialized before `backend` starts.
- **`redis` (`redis:7-alpine`):** Used for rate limiting and 24h `contact_clicks` deduplication.
- **`backend`:** Runs `npx prisma migrate deploy` on startup, exposes port `4000` internally.
- **`frontend`:** Built with `output: 'standalone'`, exposes port `3000` internally.
- **`nginx`:** Exposes `80/443`, sets `client_max_body_size 30M` (for 25 MB PDF + 4 preview images), proxies `/api/*` to `backend:4000` and all other routes to `frontend:3000`.