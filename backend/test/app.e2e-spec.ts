import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from './../src/prisma.service.js';
import { PublicController } from './../src/public/public.controller.js';
import { StorageService } from './../src/storage/storage.service.js';
import { WatermarkService } from './../src/watermark/watermark.service.js';

describe('Public API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PublicController],
      providers: [
        { provide: PrismaService, useValue: {
          $transaction: async (operations: unknown[]) => Promise.all(operations),
          listing: { findMany: async () => [], count: async () => 0 },
        } },
        { provide: StorageService, useValue: {} },
        { provide: WatermarkService, useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/public/listings (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/public/listings')
      .expect(200)
      .expect(({ body }) => {
        if (!Array.isArray(body.items)) throw new Error('Expected a paginated listing response');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
