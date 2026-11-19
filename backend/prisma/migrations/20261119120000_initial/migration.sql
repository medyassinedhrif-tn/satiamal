-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SELLER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "Cycle" AS ENUM ('primaire', 'college', 'lycee');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('joudhadha', 'devoir', 'serie', 'cours');

-- CreateEnum
CREATE TYPE "TopupType" AS ENUM ('CODE_PACK', 'BOOST');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('D17', 'FLOUCI', 'RIB');

-- CreateEnum
CREATE TYPE "TopupStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('PIRACY', 'SCAM', 'WRONG_INFO');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(120) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SELLER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "seller_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "whatsapp" VARCHAR(20) NOT NULL,
    "messenger_url" TEXT,
    "bio" VARCHAR(300),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "code_balance" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seller_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "cycle" "Cycle" NOT NULL,
    "grade" VARCHAR(40) NOT NULL,
    "subject" VARCHAR(60) NOT NULL,
    "trimester" SMALLINT,
    "material_type" "MaterialType" NOT NULL,
    "price_tnd" DECIMAL(7,2) NOT NULL,
    "preview_images" TEXT[],
    "r2_pdf_key" TEXT NOT NULL,
    "is_boosted" BOOLEAN NOT NULL DEFAULT false,
    "boost_expires_at" TIMESTAMPTZ,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "contact_clicks" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(12) NOT NULL,
    "listing_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "buyer_phone" VARCHAR(20) NOT NULL,
    "buyer_note" VARCHAR(100),
    "hmac_sig" VARCHAR(32) NOT NULL,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "max_downloads" INTEGER NOT NULL DEFAULT 3,
    "first_used_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code_id" UUID NOT NULL,
    "ip_address" INET NOT NULL,
    "user_agent" TEXT,
    "downloaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_topups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seller_id" UUID NOT NULL,
    "topup_type" "TopupType" NOT NULL,
    "pack_codes" INTEGER,
    "listing_id" UUID,
    "boost_days" INTEGER,
    "amount_tnd" DECIMAL(7,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "receipt_ref" TEXT NOT NULL,
    "status" "TopupStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_topups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "listing_id" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" VARCHAR(400),
    "reporter_ip" INET NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_user_id_key" ON "seller_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_slug_key" ON "seller_profiles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "listings_status_is_boosted_cycle_grade_subject_created_at_idx" ON "listings"("status", "is_boosted" DESC, "cycle", "grade", "subject", "created_at" DESC);

-- CreateIndex
CREATE INDEX "listings_seller_id_created_at_idx" ON "listings"("seller_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "download_codes_code_key" ON "download_codes"("code");

-- CreateIndex
CREATE INDEX "download_codes_seller_id_buyer_phone_idx" ON "download_codes"("seller_id", "buyer_phone");

-- CreateIndex
CREATE INDEX "download_codes_code_idx" ON "download_codes"("code");

-- CreateIndex
CREATE INDEX "download_logs_code_id_downloaded_at_idx" ON "download_logs"("code_id", "downloaded_at" DESC);

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_codes" ADD CONSTRAINT "download_codes_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_codes" ADD CONSTRAINT "download_codes_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_logs" ADD CONSTRAINT "download_logs_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "download_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_topups" ADD CONSTRAINT "code_topups_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_topups" ADD CONSTRAINT "code_topups_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_topups" ADD CONSTRAINT "code_topups_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_code_balance_check" CHECK ("code_balance" >= 0);
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_whatsapp_check" CHECK ("whatsapp" ~ '^216[2459][0-9]{7}$');
ALTER TABLE "listings" ADD CONSTRAINT "listings_price_tnd_check" CHECK ("price_tnd" >= 0);
ALTER TABLE "listings" ADD CONSTRAINT "listings_trimester_check" CHECK ("trimester" IS NULL OR "trimester" IN (1, 2, 3));
ALTER TABLE "listings" ADD CONSTRAINT "listings_preview_count_check" CHECK (cardinality("preview_images") BETWEEN 1 AND 4);
ALTER TABLE "download_codes" ADD CONSTRAINT "download_codes_buyer_phone_check" CHECK ("buyer_phone" ~ '^216[2459][0-9]{7}$');
ALTER TABLE "download_codes" ADD CONSTRAINT "download_codes_limits_check" CHECK ("download_count" >= 0 AND "max_downloads" = 3 AND "download_count" <= "max_downloads");
ALTER TABLE "download_codes" ADD CONSTRAINT "download_codes_format_check" CHECK ("code" ~ '^EDU-[A-HJ-KM-NP-Z2-9]{4}$');
ALTER TABLE "code_topups" ADD CONSTRAINT "code_topups_amount_check" CHECK ("amount_tnd" >= 0);
ALTER TABLE "code_topups" ADD CONSTRAINT "code_topups_request_shape_check" CHECK (
    ("topup_type" = 'CODE_PACK' AND "pack_codes" IN (15, 50, 100) AND "listing_id" IS NULL AND "boost_days" IS NULL)
 OR ("topup_type" = 'BOOST' AND "pack_codes" IS NULL AND "listing_id" IS NOT NULL AND "boost_days" IN (7, 14, 30))
);
