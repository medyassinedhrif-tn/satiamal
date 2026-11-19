import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { fileTypeFromBuffer } from 'file-type';
import { PDFParse } from 'pdf-parse';
import sharp from 'sharp';
import { createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class WatermarkService {
  async stampInvisibleWatermark(pdfBuffer: Buffer, buyerPhone: string, code: string, hmacSig: string) {
    const pdf = await PDFDocument.load(pdfBuffer);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const hidden = `BUYER:${buyerPhone}|CODE:${code}|SIG:${hmacSig}`;
    pdf.setSubject(`LIC:${Buffer.from(`${buyerPhone}|${code}|${hmacSig}`).toString('base64')}`);
    pdf.setKeywords([hmacSig, code]);
    for (const page of pdf.getPages()) {
      page.drawText(hidden, { x: 2, y: 2, size: 2, font, color: rgb(1, 1, 1) });
      page.drawText(`${buyerPhone} - ${code}`, {
        x: page.getWidth() * 0.18,
        y: page.getHeight() * 0.5,
        size: 20,
        font,
        color: rgb(0.95, 0.95, 0.95),
        opacity: 0.02,
        rotate: degrees(35),
      });
    }
    return Buffer.from(await pdf.save());
  }

  async inspectLeakedFile(buffer: Buffer) {
    if (buffer.length > 25 * 1024 * 1024) throw new BadRequestException('Leak-check file must be 25 MB or smaller');
    const type = await fileTypeFromBuffer(buffer);
    if (type?.mime === 'application/pdf') {
      const parser = new PDFParse({ data: buffer });
      let parsedText: string;
      let subject: string | undefined;
      try {
        const text = await parser.getText();
        const info = await parser.getInfo();
        parsedText = text.text;
        subject = info.info?.Subject;
      } finally {
        await parser.destroy();
      }
      const textMatch = parsedText.match(/BUYER:(216[2459]\d{7})\|CODE:([A-Z0-9-]+)\|SIG:([a-f0-9]{16})/i);
      let metadataMatch: RegExpMatchArray | null = null;
      if (subject?.startsWith('LIC:')) {
        try {
          metadataMatch = Buffer.from(subject.slice(4), 'base64').toString('utf8').match(/^(216[2459]\d{7})\|([A-Z0-9-]+)\|([a-f0-9]{16})$/i);
        } catch { /* malformed metadata is not a valid match */ }
      }
      const match = textMatch ?? metadataMatch;
      if (!match) return { detected: false };
      const [phone, code, signature] = match.slice(1);
      const expected = createHmac('sha256', process.env.WATERMARK_HMAC_SECRET ?? '')
        .update(`${code}:${phone}`).digest('hex').slice(0, 16);
      const verified = Buffer.byteLength(signature) === Buffer.byteLength(expected) &&
        timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      return { detected: true, buyerPhone: phone, code, verified };
    }
    if (type?.mime?.startsWith('image/')) {
      const enhanced = await sharp(buffer).greyscale().normalise().linear(4.5, -1.5).webp().toBuffer();
      return { type: 'IMAGE_ENHANCED', enhancedImageBase64: enhanced.toString('base64') };
    }
    throw new BadRequestException('Upload a PDF or screenshot image');
  }
}
