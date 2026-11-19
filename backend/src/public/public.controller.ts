import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Body,
  Req,
  Res,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { Redis } from 'ioredis';
import sharp from 'sharp';
import { PrismaService } from '../prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { WatermarkService } from '../watermark/watermark.service.js';
import { normalizeTunisianPhone } from '../auth/phone.js';

class RedeemDto {
  @IsString() code!: string;
  @IsString() buyerPhone!: string;
  @IsString() listingId!: string;
  @IsString() turnstileToken!: string;
}
class ReportDto {
  @IsIn(['PIRACY', 'SCAM', 'WRONG_INFO']) reason!: 'PIRACY' | 'SCAM' | 'WRONG_INFO';
  @IsOptional() @IsString() @MaxLength(400) details?: string;
  @IsString() turnstileToken!: string;
}

@Controller('public')
export class PublicController {
  private readonly redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }) : null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly watermark: WatermarkService,
  ) {}

  @Get('listings')
  async listings(@Query() q: Record<string, string>) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(24, Math.max(1, Number(q.limit) || 12));
    const where = {
      status: 'ACTIVE' as const,
      ...(q.cycle ? { cycle: q.cycle as never } : {}),
      ...(q.grade ? { grade: q.grade } : {}),
      ...(q.subject ? { subject: { contains: q.subject, mode: 'insensitive' as const } } : {}),
      ...(q.trimester ? { trimester: Number(q.trimester) } : {}),
      ...(q.material_type ? { materialType: q.material_type as never } : {}),
      ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' as const } }, { description: { contains: q.q, mode: 'insensitive' as const } }, { subject: { contains: q.q, mode: 'insensitive' as const } }] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        orderBy: [{ isBoosted: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, title: true, description: true, cycle: true, grade: true, subject: true,
          trimester: true, materialType: true, priceTnd: true, previewImages: true, isBoosted: true,
          createdAt: true,
          seller: { select: { sellerProfile: { select: { slug: true, displayName: true, isVerified: true } } } },
        },
      }),
      this.prisma.listing.count({ where }),
    ]);
    return { items, page, limit, total };
  }

  @Get('listings/:id')
  async listing(@Param('id') id: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id, status: 'ACTIVE' },
      select: {
        id: true, title: true, description: true, cycle: true, grade: true, subject: true,
        trimester: true, materialType: true, priceTnd: true, previewImages: true, isBoosted: true,
        seller: { select: { sellerProfile: { select: { slug: true, displayName: true, isVerified: true, whatsapp: true, messengerUrl: true, whatsappMessageTemplate: true } } } },
      },
    });
    if (!listing) throw new NotFoundException();
    return listing;
  }

  @Get('stores/:slug')
  async store(@Param('slug') slug: string, @Query('grade') grade?: string, @Query('trimester') trimester?: string) {
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { slug },
      select: {
        slug: true, displayName: true, bio: true, isVerified: true, messengerUrl: true,
        user: { select: { listings: { where: { status: 'ACTIVE', ...(grade ? { grade } : {}), ...(trimester ? { trimester: Number(trimester) } : {}) }, orderBy: [{ isBoosted: 'desc' }, { createdAt: 'desc' }], select: { id: true, title: true, cycle: true, grade: true, subject: true, trimester: true, materialType: true, priceTnd: true, previewImages: true } } } },
      },
    });
    if (!profile) throw new NotFoundException();
    return { ...profile, listings: profile.user.listings, user: undefined };
  }

  @Get('og/listing/:id')
  async listingOg(@Param('id') id: string, @Res() response: Response) {
    const listing = await this.prisma.listing.findFirst({
      where: { id, status: 'ACTIVE' },
      select: { title: true, grade: true, subject: true, priceTnd: true },
    });
    if (!listing) throw new NotFoundException();
    const svg = this.ogSvg(listing.title, `${listing.grade} · ${listing.subject}`, `${String(listing.priceTnd)} TND`);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    response.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    response.type('image/png').send(png);
  }

  @Get('og/store/:slug')
  async storeOg(@Param('slug') slug: string, @Res() response: Response) {
    const profile = await this.prisma.sellerProfile.findUnique({ where: { slug }, select: { displayName: true, isVerified: true } });
    if (!profile) throw new NotFoundException();
    const svg = this.ogSvg(profile.displayName, profile.isVerified ? 'Verified Tunisian teacher' : 'Teacher storefront', '3alamni.tn');
    response.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    response.type('image/png').send(await sharp(Buffer.from(svg)).png().toBuffer());
  }

  @Post('listings/:id/click')
  @HttpCode(200)
  async click(@Param('id') id: string, @Req() request: Request) {
    const exists = await this.prisma.listing.findFirst({ where: { id, status: 'ACTIVE' }, select: { id: true } });
    if (!exists) throw new NotFoundException();
    const ip = request.ip ?? 'unknown';
    let isNew = true;
    if (this.redis) {
      try {
        if (this.redis.status === 'wait') await this.redis.connect();
        isNew = (await this.redis.set(`click:${id}:${ip}`, '1', 'EX', 86400, 'NX')) === 'OK';
      } catch (error) {
        console.error('Click deduplication unavailable', error);
      }
    }
    if (isNew) await this.prisma.listing.update({ where: { id }, data: { contactClicks: { increment: 1 } } });
    return { success: true };
  }

  @Post('codes/redeem')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  async redeem(@Body() body: RedeemDto, @Req() request: Request, @Res() response: Response) {
    await this.verifyTurnstile(body.turnstileToken);
    const phone = normalizeTunisianPhone(body.buyerPhone);
    const code = body.code.trim().toUpperCase();
    const download = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM download_codes WHERE code = ${code} FOR UPDATE`;
      const record = await tx.downloadCode.findUnique({ where: { code } });
      if (!record || record.listingId !== body.listingId || record.buyerPhone !== phone) throw new NotFoundException('Invalid code or phone number');
      if (record.isRevoked) throw new ConflictException('This code has been revoked');
      if (record.downloadCount >= record.maxDownloads) throw new ConflictException('Download limit reached');
      const now = new Date();
      if (record.expiresAt && record.expiresAt <= now) throw new ConflictException('The 24-hour download window has expired');
      const listing = await tx.listing.findFirst({ where: { id: record.listingId, status: 'ACTIVE' }, select: { r2PdfKey: true } });
      if (!listing) throw new NotFoundException('Listing is not available');
      const original = await this.storage.getPrivatePdf(listing.r2PdfKey);
      const stamped = await this.watermark.stampInvisibleWatermark(original, phone, record.code, record.hmacSig);
      const firstUse = record.firstUsedAt === null;
      await tx.downloadCode.update({
        where: { id: record.id },
        data: {
          downloadCount: { increment: 1 },
          ...(firstUse ? { firstUsedAt: now, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) } : {}),
        },
      });
      await tx.downloadLog.create({ data: { codeId: record.id, ipAddress: request.ip ?? '0.0.0.0', userAgent: request.header('user-agent') } });
      return stamped;
    }, { timeout: 60_000 });
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    response.send(download);
  }

  @Post('listings/:id/report')
  @HttpCode(201)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  async report(@Param('id') id: string, @Body() body: ReportDto, @Req() request: Request) {
    await this.verifyTurnstile(body.turnstileToken);
    const listing = await this.prisma.listing.findFirst({ where: { id, status: 'ACTIVE' }, select: { id: true } });
    if (!listing) throw new NotFoundException();
    return this.prisma.listingReport.create({
      data: { listingId: id, reason: body.reason, details: body.details, reporterIp: request.ip ?? '0.0.0.0' },
      select: { id: true, status: true, createdAt: true },
    });
  }

  private async verifyTurnstile(token: string) {
    if (!process.env.TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET_KEY === 'local-disabled') {
      if (process.env.NODE_ENV === 'production') throw new UnauthorizedException('Bot protection is not configured');
      return;
    }
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token }),
    });
    const payload = (await result.json()) as { success?: boolean };
    if (!payload.success) throw new BadRequestException('Turnstile verification failed');
  }

  private ogSvg(title: string, subtitle: string, label: string) {
    const esc = (text: string) => text.replace(/[<>&"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[char]!);
    return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop stop-color="#0e766e"/><stop offset="1" stop-color="#123d49"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><circle cx="1050" cy="90" r="220" fill="#ffffff" opacity=".06"/><text x="90" y="130" fill="#bef264" font-size="32" font-family="Arial">3alamni.tn</text><text x="90" y="300" fill="white" font-size="62" font-weight="700" font-family="Arial">${esc(title.slice(0, 40))}</text><text x="90" y="375" fill="#d1e5df" font-size="34" font-family="Arial">${esc(subtitle.slice(0, 60))}</text><rect x="90" y="450" width="270" height="76" rx="38" fill="#bef264"/><text x="225" y="499" text-anchor="middle" fill="#143d3b" font-size="32" font-weight="700" font-family="Arial">${esc(label.slice(0, 24))}</text></svg>`;
  }
}
