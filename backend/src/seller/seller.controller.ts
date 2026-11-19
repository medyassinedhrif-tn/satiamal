import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import 'multer';
import { PrismaService } from '../prisma.service.js';
import { JwtGuard, type AuthRequest } from '../auth/jwt.guard.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { StorageService } from '../storage/storage.service.js';
import { WatermarkService } from '../watermark/watermark.service.js';
import { normalizeTunisianPhone } from '../auth/phone.js';

class ListingDto {
  @IsString() @MaxLength(160) title!: string;
  @IsString() description!: string;
  @IsIn(['primaire', 'college', 'lycee']) cycle!: 'primaire' | 'college' | 'lycee';
  @IsString() @MaxLength(40) grade!: string;
  @IsString() @MaxLength(60) subject!: string;
  @IsOptional() @IsInt() @Min(1) @Max(3) trimester?: number;
  @IsIn(['joudhadha', 'devoir', 'serie', 'cours']) materialType!: 'joudhadha' | 'devoir' | 'serie' | 'cours';
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/) priceTnd!: string;
}

class UpdateListingDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(['primaire', 'college', 'lycee']) cycle?: 'primaire' | 'college' | 'lycee';
  @IsOptional() @IsString() @MaxLength(40) grade?: string;
  @IsOptional() @IsString() @MaxLength(60) subject?: string;
  @IsOptional() @IsInt() @Min(1) @Max(3) trimester?: number;
  @IsOptional() @IsIn(['joudhadha', 'devoir', 'serie', 'cours']) materialType?: 'joudhadha' | 'devoir' | 'serie' | 'cours';
  @IsOptional() @IsString() @Matches(/^\d+(\.\d{1,2})?$/) priceTnd?: string;
}

class CodeDto {
  @IsString() listingId!: string;
  @IsString() buyerPhone!: string;
  @IsOptional() @IsString() @MaxLength(100) buyerNote?: string;
}

class TopupDto {
  @IsIn(['CODE_PACK', 'BOOST']) topupType!: 'CODE_PACK' | 'BOOST';
  @IsOptional() @IsInt() packCodes?: number;
  @IsOptional() @IsString() listingId?: string;
  @IsOptional() @IsInt() boostDays?: number;
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/) amountTnd!: string;
  @IsIn(['D17', 'FLOUCI', 'RIB']) paymentMethod!: 'D17' | 'FLOUCI' | 'RIB';
  @IsString() @MaxLength(300) receiptRef!: string;
}

const codeAlphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

@Controller('seller')
@UseGuards(JwtGuard, CsrfGuard)
export class SellerController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly watermark: WatermarkService,
  ) {}

  @Get('dashboard')
  async dashboard(@Req() req: AuthRequest) {
    const [profile, listings, generated] = await Promise.all([
      this.prisma.sellerProfile.findUniqueOrThrow({
        where: { userId: req.user.sub },
        select: { codeBalance: true },
      }),
      this.prisma.listing.aggregate({
        where: { sellerId: req.user.sub },
        _sum: { contactClicks: true },
        _count: { id: true },
      }),
      this.prisma.downloadCode.count({ where: { sellerId: req.user.sub } }),
    ]);
    return {
      codeBalance: profile.codeBalance,
      contactClicks: listings._sum.contactClicks ?? 0,
      activeListings: await this.prisma.listing.count({ where: { sellerId: req.user.sub, status: 'ACTIVE' } }),
      totalListings: listings._count.id,
      codesGenerated: generated,
    };
  }

  @Get('listings')
  listListings(@Req() req: AuthRequest) {
    return this.prisma.listing.findMany({
      where: { sellerId: req.user.sub },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, description: true, cycle: true, grade: true, subject: true,
        trimester: true, materialType: true, priceTnd: true, previewImages: true,
        isBoosted: true, status: true, contactClicks: true, createdAt: true,
      },
    });
  }

  @Post('listings')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'previews', maxCount: 4 },
    { name: 'pdf', maxCount: 1 },
  ], { limits: { fileSize: 25 * 1024 * 1024, files: 5 } }))
  async createListing(
    @Req() req: AuthRequest,
    @Body() body: ListingDto,
    @UploadedFiles() files: { previews?: Express.Multer.File[]; pdf?: Express.Multer.File[] },
  ) {
    const previews = files.previews ?? [];
    const pdf = files.pdf?.[0];
    if (previews.length < 1 || previews.length > 4 || !pdf) {
      throw new BadRequestException('Upload 1–4 preview images and one PDF');
    }
    const price = Number(body.priceTnd);
    if (!Number.isFinite(price) || price < 0 || price > 99999.99) throw new BadRequestException('Invalid price');
    const profile = await this.prisma.sellerProfile.findUniqueOrThrow({
      where: { userId: req.user.sub }, select: { slug: true },
    });
    const listingId = randomUUID();
    const previewImages = await this.storage.processPreviewImages(previews, profile.slug);
    let pdfKey: string;
    try {
      pdfKey = await this.storage.uploadPrivatePdf(pdf, req.user.sub, listingId);
    } catch (error) {
      await Promise.all(previewImages.map((url) => this.storage.deleteKey(url.split('/').slice(-2).join('/'), false)));
      throw error;
    }
    try {
      return await this.prisma.listing.create({
        data: {
          id: listingId, sellerId: req.user.sub, title: body.title.trim(), description: body.description,
          cycle: body.cycle, grade: body.grade.trim(), subject: body.subject.trim(),
          trimester: body.trimester, materialType: body.materialType, priceTnd: price,
          previewImages, r2PdfKey: pdfKey,
        },
        select: { id: true, title: true, status: true, previewImages: true },
      });
    } catch (error) {
      await Promise.all([
        this.storage.deleteKey(pdfKey, true),
        ...previewImages.map((url) => this.storage.deleteKey(url.split('/').slice(-2).join('/'), false)),
      ]);
      throw error;
    }
  }

  @Patch('listings/:id')
  async updateListing(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: UpdateListingDto) {
    const listing = await this.prisma.listing.findUnique({ where: { id }, select: { sellerId: true } });
    if (!listing) throw new NotFoundException();
    if (listing.sellerId !== req.user.sub) throw new ForbiddenException();
    const data: Record<string, unknown> = {};
    for (const key of ['title', 'description', 'cycle', 'grade', 'subject', 'trimester', 'materialType'] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (body.priceTnd !== undefined) {
      const price = Number(body.priceTnd);
      if (!Number.isFinite(price) || price < 0 || price > 99999.99) throw new BadRequestException('Invalid price');
      data.priceTnd = price;
    }
    return this.prisma.listing.update({
      where: { id }, data,
      select: { id: true, title: true, description: true, priceTnd: true, status: true },
    });
  }

  @Delete('listings/:id')
  @HttpCode(200)
  async deleteListing(@Req() req: AuthRequest, @Param('id') id: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id }, select: { sellerId: true, r2PdfKey: true, previewImages: true } });
    if (!listing) throw new NotFoundException();
    if (listing.sellerId !== req.user.sub) throw new ForbiddenException();
    await this.prisma.listing.delete({ where: { id } });
    await Promise.all([
      this.storage.deleteKey(listing.r2PdfKey, true),
      ...listing.previewImages.map((url) => this.storage.deleteKey(url.split('/').slice(-2).join('/'), false)),
    ]);
    return { success: true };
  }

  @Get('listings/:id/fb-pack')
  async facebookPack(@Req() req: AuthRequest, @Param('id') id: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id, sellerId: req.user.sub },
      select: { title: true, grade: true, subject: true, trimester: true, priceTnd: true, previewImages: true, seller: { select: { sellerProfile: { select: { slug: true } } } } },
    });
    if (!listing) throw new NotFoundException();
    const url = `${process.env.FRONTEND_URL ?? ''}/s/${listing.seller.sellerProfile?.slug ?? ''}`;
    const text = `${listing.title}\n${listing.grade} · ${listing.subject}${listing.trimester ? ` · Trimester ${listing.trimester}` : ''}\n${String(listing.priceTnd)} TND\nDiscover more: ${url}`;
    return { text, previewImages: listing.previewImages };
  }

  @Post('codes')
  async createCode(@Req() req: AuthRequest, @Body() body: CodeDto) {
    const phone = normalizeTunisianPhone(body.buyerPhone);
    const secret = process.env.WATERMARK_HMAC_SECRET;
    if (!secret) throw new ConflictException('Watermark signing is not configured');
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({ where: { id: body.listingId }, select: { sellerId: true, status: true } });
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.sellerId !== req.user.sub) throw new ForbiddenException();
      if (listing.status !== 'ACTIVE') throw new BadRequestException('Only active listings can receive download codes');
      const profiles = await tx.$queryRaw<Array<{ code_balance: number }>>`
        SELECT code_balance FROM seller_profiles WHERE user_id = ${req.user.sub}::uuid FOR UPDATE
      `;
      if (!profiles[0] || profiles[0].code_balance < 1) {
        throw new HttpException('No download codes remaining', HttpStatus.PAYMENT_REQUIRED);
      }
      await tx.sellerProfile.update({ where: { userId: req.user.sub }, data: { codeBalance: { decrement: 1 } } });
      for (let attempt = 0; attempt < 20; attempt++) {
        let code = 'EDU-';
        for (let index = 0; index < 4; index++) code += codeAlphabet[randomInt(codeAlphabet.length)];
        if (await tx.downloadCode.findUnique({ where: { code }, select: { id: true } })) continue;
        const hmacSig = createHmac('sha256', secret).update(`${code}:${phone}`).digest('hex').slice(0, 16);
        return tx.downloadCode.create({
          data: { code, listingId: body.listingId, sellerId: req.user.sub, buyerPhone: phone, buyerNote: body.buyerNote, hmacSig },
          select: { id: true, code: true, buyerPhone: true, listingId: true, createdAt: true },
        });
      }
      throw new ConflictException('Unable to allocate a unique download code');
    });
  }

  @Get('codes')
  async codes(@Req() req: AuthRequest, @Query('phone') phone?: string, @Query('listingId') listingId?: string) {
    return this.prisma.downloadCode.findMany({
      where: {
        sellerId: req.user.sub,
        ...(phone ? { buyerPhone: normalizeTunisianPhone(phone) } : {}),
        ...(listingId ? { listingId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, code: true, listingId: true, buyerPhone: true, buyerNote: true, downloadCount: true, maxDownloads: true, expiresAt: true, isRevoked: true, createdAt: true },
    });
  }

  @Patch('codes/:id/revoke')
  async revokeCode(@Req() req: AuthRequest, @Param('id') id: string) {
    const code = await this.prisma.downloadCode.findUnique({ where: { id }, select: { sellerId: true } });
    if (!code) throw new NotFoundException();
    if (code.sellerId !== req.user.sub) throw new ForbiddenException();
    return this.prisma.downloadCode.update({ where: { id }, data: { isRevoked: true }, select: { id: true, isRevoked: true } });
  }

  @Post('leak-check')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024, files: 1 } }))
  async leakCheck(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Upload one leak-check file');
    return this.watermark.inspectLeakedFile(file.buffer);
  }

  @Post('topups')
  async createTopup(@Req() req: AuthRequest, @Body() body: TopupDto) {
    if (body.topupType === 'CODE_PACK' && ![15, 50, 100].includes(body.packCodes ?? 0)) {
      throw new BadRequestException('Choose a supported code pack');
    }
    if (body.topupType === 'CODE_PACK') {
      const packPrices: Record<number, number> = { 15: 15, 50: 35, 100: 50 };
      if (Number(body.amountTnd) !== packPrices[body.packCodes ?? 0]) {
        throw new BadRequestException('The code pack amount is incorrect');
      }
    }
    if (body.topupType === 'BOOST' && (!body.listingId || ![7, 14, 30].includes(body.boostDays ?? 0))) {
      throw new BadRequestException('Choose a listing and a 7, 14, or 30 day boost');
    }
    if (body.listingId) {
      const listing = await this.prisma.listing.findUnique({ where: { id: body.listingId }, select: { sellerId: true } });
      if (!listing) throw new NotFoundException();
      if (listing.sellerId !== req.user.sub) throw new ForbiddenException();
    }
    return this.prisma.codeTopup.create({
      data: {
        sellerId: req.user.sub, topupType: body.topupType, packCodes: body.packCodes,
        listingId: body.listingId, boostDays: body.boostDays, amountTnd: Number(body.amountTnd),
        paymentMethod: body.paymentMethod, receiptRef: body.receiptRef,
      },
      select: { id: true, topupType: true, status: true, amountTnd: true, createdAt: true },
    });
  }

  @Get('topups')
  topups(@Req() req: AuthRequest) {
    return this.prisma.codeTopup.findMany({
      where: { sellerId: req.user.sub }, orderBy: { createdAt: 'desc' },
      select: { id: true, topupType: true, packCodes: true, listingId: true, boostDays: true, amountTnd: true, paymentMethod: true, receiptRef: true, status: true, createdAt: true },
    });
  }
}
