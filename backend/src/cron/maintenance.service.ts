import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 * * * *')
  async expireBoosts() {
    const result = await this.prisma.listing.updateMany({
      where: { isBoosted: true, boostExpiresAt: { lt: new Date() } },
      data: { isBoosted: false },
    });
    if (result.count) this.logger.log(`Expired ${result.count} listing boosts`);
  }

  @Cron('0 3 * * *')
  async cleanRefreshTokens() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: cutoff } } });
    if (result.count) this.logger.log(`Deleted ${result.count} expired refresh tokens`);
  }
}
