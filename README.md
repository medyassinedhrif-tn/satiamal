# 3alamni.tn

Teacher-to-teacher digital marketplace MVP for Tunisian classroom resources.

## Stack

- Next.js App Router frontend (`frontend/`)
- NestJS API with Prisma (`backend/`)
- PostgreSQL, Redis, Cloudflare R2-compatible storage, and Nginx

## Local setup

1. Copy `.env.example` to `.env` and set database and security values.
2. Install dependencies with `npm ci` in `backend/` and `frontend/`.
3. Generate the Prisma client: `cd backend && npx prisma generate`.
4. Start the infrastructure and apps with `docker compose up --build`.

The public catalog works without a buyer account. Sellers register at `/register`;
admins are provisioned out-of-band and use `/admin`. Configure Turnstile and R2
before enabling public registration, downloads, or file uploads in production.

## Deployment notes

Nginx expects TLS files under `certbot/conf/live/<DOMAIN>/`. Obtain the initial
Let's Encrypt certificate before starting the HTTPS virtual host. One way to
bootstrap it is `docker run --rm -p 80:80 -v "$PWD/certbot/conf:/etc/letsencrypt" -v "$PWD/certbot/www:/var/www/certbot" certbot/certbot certonly --standalone -d "$DOMAIN"`.
After Compose starts, create the initial admin with
`docker compose exec backend npm run seed:admin`; it reads `ADMIN_EMAIL` and
`ADMIN_PASSWORD` from the backend environment and refuses to elevate an
existing account. Never expose the private PDF bucket through a public CDN. Set
strong, unique secrets for all JWT and watermark keys; do not commit `.env`.