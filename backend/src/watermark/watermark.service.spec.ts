import { createHmac } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { WatermarkService } from './watermark.service.js';

describe('WatermarkService', () => {
  it('embeds a verifiable buyer watermark that can be read from a leaked PDF', async () => {
    const secret = 'test-watermark-secret';
    const previousSecret = process.env.WATERMARK_HMAC_SECRET;
    process.env.WATERMARK_HMAC_SECRET = secret;
    try {
      const buyerPhone = '21622123456';
      const code = 'EDU-ABCD';
      const signature = createHmac('sha256', secret).update(`${code}:${buyerPhone}`).digest('hex').slice(0, 16);
      const original = await PDFDocument.create();
      original.addPage();

      const service = new WatermarkService();
      const stamped = await service.stampInvisibleWatermark(
        Buffer.from(await original.save()),
        buyerPhone,
        code,
        signature,
      );

      await expect(service.inspectLeakedFile(Buffer.from(stamped))).resolves.toEqual({
        detected: true,
        buyerPhone,
        code,
        verified: true,
      });
    } finally {
      if (previousSecret === undefined) delete process.env.WATERMARK_HMAC_SECRET;
      else process.env.WATERMARK_HMAC_SECRET = previousSecret;
    }
  });
});
