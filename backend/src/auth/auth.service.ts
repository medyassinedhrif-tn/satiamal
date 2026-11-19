import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { normalizeTunisianPhone } from './phone.js';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: { email: string; password: string; displayName: string; slug: string; whatsapp: string }) {
    const email = input.email.trim().toLowerCase();
    const slug = input.slug.toLowerCase().trim();
    if (!/^[a-z0-9-]{3,60}$/.test(slug)) throw new ConflictException('Invalid store slug');
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    try {
      return await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          sellerProfile: {
            create: {
              slug,
              displayName: input.displayName.trim(),
              whatsapp: normalizeTunisianPhone(input.whatsapp),
              codeBalance: 5,
            },
          },
        },
        include: { sellerProfile: true },
      });
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('Email or store slug already exists');
      }
      throw error;
    }
  }

  async validate(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user?.isActive || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }

  async issue(user: { id: string; role: string }) {
    const refresh = randomBytes(64).toString('hex');
    const csrf = randomBytes(32).toString('hex');
    const access = await this.jwt.signAsync(
      { sub: user.id, role: user.role },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refresh),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return { access, refresh, csrf };
  }

  async rotate(refresh: string) {
    const hash = hashToken(refresh);
    const current = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!current) throw new UnauthorizedException('Invalid refresh token');
    if (current.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: current.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (current.expiresAt <= new Date()) throw new UnauthorizedException('Refresh token expired');
    const rotated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count !== 1) return null;
      const user = await tx.user.findUniqueOrThrow({ where: { id: current.userId } });
      if (!user.isActive) throw new UnauthorizedException('Account is disabled');
      const next = randomBytes(64).toString('hex');
      const csrf = randomBytes(32).toString('hex');
      const access = await this.jwt.signAsync(
        { sub: user.id, role: user.role },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
      );
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(next),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      return { access, refresh: next, csrf };
    });
    if (!rotated) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: current.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    return rotated;
  }
}
