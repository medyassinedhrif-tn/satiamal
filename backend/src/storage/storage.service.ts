import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import 'multer';

@Injectable()
export class StorageService {
  private readonly client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  });

  private ensureConfigured(bucket: string | undefined): string {
    if (!bucket || !process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      throw new ServiceUnavailableException('File storage is not configured');
    }
    return bucket;
  }

  async processPreviewImages(files: Express.Multer.File[], sellerSlug: string): Promise<string[]> {
    if (files.length < 1 || files.length > 4) throw new BadRequestException('Upload between 1 and 4 preview images');
    const bucket = this.ensureConfigured(process.env.R2_PUBLIC_BUCKET);
    if (!process.env.R2_PUBLIC_CDN_URL) throw new ServiceUnavailableException('Preview CDN is not configured');
    const urls: string[] = [];
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Each preview must be 5 MB or smaller');
        const type = await fileTypeFromBuffer(file.buffer);
        if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime)) {
          throw new BadRequestException('Preview must be JPEG, PNG, or WebP');
        }
        const watermark = Buffer.from(
          `<svg width="1000" height="160"><text x="0" y="100" fill="white" fill-opacity=".55" font-size="46" font-family="Arial" transform="rotate(-18 300 80)">3alamni.tn | /s/${sellerSlug}</text></svg>`,
        );
        const output = await sharp(file.buffer)
          .rotate()
          .resize({ width: 1000, withoutEnlargement: true })
          .composite([{ input: watermark, tile: true, blend: 'over' }])
          .webp({ quality: 80 })
          .toBuffer();
        const key = `previews/${randomUUID()}.webp`;
        await this.client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: output, ContentType: 'image/webp' }));
        urls.push(`${process.env.R2_PUBLIC_CDN_URL.replace(/\/$/, '')}/${key}`);
      }
    } catch (error) {
      const cleanup = await Promise.allSettled(urls.map((url) => this.deleteKey(url.split('/').slice(-2).join('/'), false)));
      const failures = cleanup.filter((result) => result.status === 'rejected');
      if (failures.length) console.error(`Failed to clean up ${failures.length} preview upload(s)`);
      throw error;
    }
    return urls;
  }

  async uploadPrivatePdf(file: Express.Multer.File, sellerId: string, listingId: string): Promise<string> {
    if (file.size > 25 * 1024 * 1024) throw new BadRequestException('PDF must be 25 MB or smaller');
    const type = await fileTypeFromBuffer(file.buffer);
    if (type?.mime !== 'application/pdf') throw new BadRequestException('Document must be a PDF');
    const bucket = this.ensureConfigured(process.env.R2_PRIVATE_BUCKET);
    const key = `private-pdfs/${sellerId}/${listingId}.pdf`;
    await this.client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: file.buffer, ContentType: 'application/pdf' }));
    return key;
  }

  async getPrivatePdf(key: string): Promise<Buffer> {
    const bucket = this.ensureConfigured(process.env.R2_PRIVATE_BUCKET);
    const response = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!response.Body) throw new ServiceUnavailableException('Stored document is empty');
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async deleteKey(key: string, isPrivate: boolean): Promise<void> {
    const bucket = this.ensureConfigured(isPrivate ? process.env.R2_PRIVATE_BUCKET : process.env.R2_PUBLIC_BUCKET);
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}
