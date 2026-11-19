import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { PublicController } from './public/public.controller.js';
import { SellerController } from './seller/seller.controller.js';
import { AdminController } from './admin/admin.controller.js';
import { JwtGuard } from './auth/jwt.guard.js';
import { CsrfGuard } from './auth/csrf.guard.js';
import { AdminGuard } from './auth/admin.guard.js';
import { StorageService } from './storage/storage.service.js';
import { WatermarkService } from './watermark/watermark.service.js';
import { MaintenanceService } from './cron/maintenance.service.js';
import { RedisThrottlerStorage } from './redis/redis-throttler.storage.js';

const redisThrottlerStorage = new RedisThrottlerStorage();

@Module({
  imports: [
    JwtModule.register({}),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      storage: redisThrottlerStorage,
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [AuthController, PublicController, SellerController, AdminController],
  providers: [
    PrismaService,
    AuthService,
    JwtGuard,
    CsrfGuard,
    AdminGuard,
    StorageService,
    WatermarkService,
    MaintenanceService,
    { provide: RedisThrottlerStorage, useValue: redisThrottlerStorage },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
