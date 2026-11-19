import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import 'multer';
import { PrismaService } from '../prisma.service.js';
import { JwtGuard, type AuthRequest } from '../auth/jwt.guard.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { normalizeTunisianPhone } from '../auth/phone.js';
import { StorageService } from '../storage/storage.service.js';

class ConciergeDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(12) password!: string;
  @IsString() displayName!: string;
  @IsString() slug!: string;
  @IsString() whatsapp!: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() initialListings?: string;
}

class ReviewDto {
  @IsIn(['APPROVED', 'REJECTED']) status!: 'APPROVED' | 'REJECTED';
}
class VerifyDto { @IsBoolean() isVerified!: boolean }
class ModerateDto { @IsIn(['ACTIVE', 'HIDDEN']) status!: 'ACTIVE' | 'HIDDEN' }
class ReportReviewDto { @IsIn(['RESOLVED', 'DISMISSED']) status!: 'RESOLVED' | 'DISMISSED' }

type InitialListing = {
  title: string;
  description: string;
  cycle: 'primaire' | 'college' | 'lycee';
  grade: string;
  subject: string;
  trimester?: number;
  materialType: 'joudhadha' | 'devoir' | 'serie' | 'cours';
  priceTnd: number;
};

@Controller('admin')
@UseGuards(JwtGuard, AdminGuard, CsrfGuard)
export class AdminController {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  @Post('concierge-seller')
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 25 * 1024 * 1024, files: 25 } }))
  async conciergeSeller(@Body() body: ConciergeDto, @UploadedFiles() files: Express.Multer.File[] = []) {
    if (!/^[a-z0-9-]{3,60}$/.test(body.slug)) throw new BadRequestException('Slug must be lowercase letters, numbers, and hyphens');
    let initialListings: InitialListing[] = [];
    if (body.initialListings) {
      try {
        const parsed: unknown = JSON.parse(body.initialListings);
        if (!Array.isArray(parsed) || parsed.length > 5) throw new Error('Expected at most 5 listing records');
        initialListings = parsed.map((item, index) => this.validateInitialListing(item, index));
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : 'Invalid initial listings');
      }
    } else if (files.length) {
      throw new BadRequestException('Listing files require initial listing details');
    }

    const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
    let userId: string;
    try {
      const user = await this.prisma.user.create({
        data: {
          email: body.email.trim().toLowerCase(), passwordHash,
          sellerProfile: {
            create: {
              slug: body.slug, displayName: body.displayName.trim(),
              whatsapp: normalizeTunisianPhone(body.whatsapp), bio: body.bio,
            },
          },
        },
        select: { id: true, email: true, sellerProfile: { select: { slug: true, displayName: true, codeBalance: true } } },
      });
      userId = user.id;
      const uploaded: Array<{ key: string; isPrivate: boolean }> = [];
      try {
        for (const [index, listing] of initialListings.entries()) {
          const previews = files.filter((file) => file.fieldname === `listing_${index}_previews`);
          const pdf = files.filter((file) => file.fieldname === `listing_${index}_pdf`);
          if (previews.length < 1 || previews.length > 4 || pdf.length !== 1) {
            throw new BadRequestException(`Listing ${index + 1} needs 1–4 previews and one PDF`);
          }
          const previewImages = await this.storage.processPreviewImages(previews, body.slug);
          uploaded.push(...previewImages.map((url) => ({ key: url.split('/').slice(-2).join('/'), isPrivate: false })));
          const listingId = randomUUID();
          const r2PdfKey = await this.storage.uploadPrivatePdf(pdf[0], userId, listingId);
          uploaded.push({ key: r2PdfKey, isPrivate: true });
          await this.prisma.listing.create({
            data: {
              id: listingId, sellerId: userId, title: listing.title.trim(), description: listing.description,
              cycle: listing.cycle, grade: listing.grade, subject: listing.subject,
              trimester: listing.trimester, materialType: listing.materialType,
              priceTnd: listing.priceTnd, previewImages, r2PdfKey,
            },
            select: { id: true },
          });
        }
        const expectedFields = new Set(initialListings.flatMap((_, index) => [`listing_${index}_previews`, `listing_${index}_pdf`]));
        if (files.some((file) => !expectedFields.has(file.fieldname))) throw new BadRequestException('Unexpected listing file field');
      } catch (error) {
        await this.prisma.user.delete({ where: { id: userId } });
        const cleanup = await Promise.allSettled(uploaded.map((asset) => this.storage.deleteKey(asset.key, asset.isPrivate)));
        const failures = cleanup.filter((result) => result.status === 'rejected');
        if (failures.length) console.error(`Failed to clean up ${failures.length} concierge upload(s)`);
        throw error;
      }
      return user;
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
        throw new BadRequestException('Email or slug already exists');
      }
      throw error;
    }
  }

  private validateInitialListing(value: unknown, index: number): InitialListing {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(`Listing ${index + 1} must be an object`);
    }
    const listing = value as Record<string, unknown>;
    const cycles = ['primaire', 'college', 'lycee'];
    const materials = ['joudhadha', 'devoir', 'serie', 'cours'];
    const title = listing.title;
    const description = listing.description;
    const grade = listing.grade;
    const subject = listing.subject;
    const cycle = listing.cycle;
    const materialType = listing.materialType;
    const priceTnd = Number(listing.priceTnd);
    const trimester = listing.trimester === undefined || listing.trimester === '' ? undefined : Number(listing.trimester);
    if (typeof title !== 'string' || !title.trim() || title.length > 160 ||
        typeof description !== 'string' || !description.trim() ||
        typeof grade !== 'string' || !grade.trim() || grade.length > 40 ||
        typeof subject !== 'string' || !subject.trim() || subject.length > 60 ||
        typeof cycle !== 'string' || !cycles.includes(cycle) ||
        typeof materialType !== 'string' || !materials.includes(materialType) ||
        !Number.isFinite(priceTnd) || priceTnd < 0 || priceTnd > 99999.99 ||
        (trimester !== undefined && ![1, 2, 3].includes(trimester))) {
      throw new BadRequestException(`Listing ${index + 1} has invalid listing details`);
    }
    return {
      title, description, grade, subject,
      cycle: cycle as InitialListing['cycle'],
      materialType: materialType as InitialListing['materialType'],
      priceTnd, trimester,
    };
  }

  @Get('topups')
  topups(@Query('status') status = 'PENDING') {
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) throw new BadRequestException('Invalid top-up status');
    return this.prisma.codeTopup.findMany({
      where: { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' },
      orderBy: { createdAt: 'asc' },
      include: { seller: { select: { id: true, email: true, sellerProfile: { select: { displayName: true, slug: true } } } } },
    });
  }

  @Patch('topups/:id/review')
  async reviewTopup(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: ReviewDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM code_topups WHERE id = ${id}::uuid FOR UPDATE`;
      const topup = await tx.codeTopup.findUnique({ where: { id } });
      if (!topup) throw new NotFoundException();
      if (topup.status !== 'PENDING') throw new BadRequestException('Top-up was already reviewed');
      const updated = await tx.codeTopup.update({
        where: { id }, data: { status: body.status, reviewedBy: req.user.sub, reviewedAt: new Date() },
      });
      if (body.status === 'APPROVED' && topup.topupType === 'CODE_PACK') {
        if (!topup.packCodes) throw new BadRequestException('Code pack size is missing');
        await tx.sellerProfile.update({
          where: { userId: topup.sellerId }, data: { codeBalance: { increment: topup.packCodes } },
        });
      } else if (body.status === 'APPROVED' && topup.topupType === 'BOOST') {
        if (!topup.listingId || !topup.boostDays) throw new BadRequestException('Boost details are missing');
        const listing = await tx.listing.findUnique({ where: { id: topup.listingId }, select: { sellerId: true } });
        if (!listing || listing.sellerId !== topup.sellerId) throw new BadRequestException('Boost listing is invalid');
        await tx.listing.update({
          where: { id: topup.listingId },
          data: { isBoosted: true, boostExpiresAt: new Date(Date.now() + topup.boostDays * 86400_000) },
        });
      }
      return updated;
    });
  }

  @Patch('sellers/:id/verify')
  verifySeller(@Param('id') id: string, @Body() body: VerifyDto) {
    return this.prisma.sellerProfile.update({
      where: { userId: id }, data: { isVerified: body.isVerified },
      select: { userId: true, slug: true, isVerified: true },
    });
  }

  @Get('sellers')
  sellers() {
    return this.prisma.user.findMany({
      where: { role: 'SELLER' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, email: true, sellerProfile: { select: { slug: true, displayName: true, isVerified: true } },
      },
    });
  }

  @Get('listings')
  listings(@Query('status') status?: string) {
    if (status && !['ACTIVE', 'HIDDEN'].includes(status)) throw new BadRequestException('Invalid listing status');
    return this.prisma.listing.findMany({
      where: status ? { status: status as 'ACTIVE' | 'HIDDEN' } : {},
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, grade: true, subject: true, status: true,
        seller: { select: { sellerProfile: { select: { displayName: true, slug: true } } } },
      },
    });
  }

  @Patch('listings/:id/moderate')
  moderateListing(@Param('id') id: string, @Body() body: ModerateDto) {
    return this.prisma.listing.update({
      where: { id }, data: { status: body.status },
      select: { id: true, status: true, title: true },
    });
  }

  @Get('reports')
  reports(@Query('status') status = 'OPEN') {
    if (!['OPEN', 'RESOLVED', 'DISMISSED'].includes(status)) throw new BadRequestException('Invalid report status');
    return this.prisma.listingReport.findMany({
      where: { status: status as 'OPEN' | 'RESOLVED' | 'DISMISSED' },
      orderBy: { createdAt: 'asc' },
      include: { listing: { select: { id: true, title: true, status: true } } },
    });
  }

  @Patch('reports/:id')
  resolveReport(@Param('id') id: string, @Body() body: ReportReviewDto) {
    return this.prisma.listingReport.update({
      where: { id }, data: { status: body.status },
      select: { id: true, status: true },
    });
  }
}
