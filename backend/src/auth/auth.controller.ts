import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma.service.js';
import { AuthService } from './auth.service.js';
import { JwtGuard, type AuthRequest } from './jwt.guard.js';
import { CsrfGuard } from './csrf.guard.js';
import { Throttle } from '@nestjs/throttler';
import { createHash } from 'node:crypto';

class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(10) password!: string;
  @IsString() @MinLength(2) displayName!: string;
  @IsString() slug!: string;
  @IsString() whatsapp!: string;
  @IsString() turnstileToken!: string;
}
class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  private cookies(response: Response, tokens: { access: string; refresh: string; csrf: string }) {
    const secure = process.env.NODE_ENV === 'production';
    response.cookie('access_token', tokens.access, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 15 * 60_000 });
    response.cookie('refresh_token', tokens.refresh, { httpOnly: true, secure, sameSite: 'lax', path: '/api/auth/refresh', maxAge: 7 * 24 * 60 * 60_000 });
    response.cookie('csrf_token', tokens.csrf, { httpOnly: false, secure, sameSite: 'lax', path: '/' });
  }

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) response: Response) {
    await this.verifyTurnstile(body.turnstileToken);
    const user = await this.auth.register(body);
    this.cookies(response, await this.auth.issue(user));
    return { id: user.id, email: user.email, profile: user.sellerProfile };
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const user = await this.auth.validate(body.email, body.password);
    this.cookies(response, await this.auth.issue(user));
    return { id: user.id, email: user.email, role: user.role };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) response: Response) {
    const token = req.cookies?.refresh_token;
    if (!token) throw new UnauthorizedException();
    this.cookies(response, await this.auth.rotate(token));
    return { success: true };
  }

  @Post('logout')
  @UseGuards(JwtGuard, CsrfGuard)
  async logout(@Req() req: AuthRequest, @Res({ passthrough: true }) response: Response) {
    const refresh = req.cookies?.refresh_token;
    if (refresh) {
      const tokenHash = createHash('sha256').update(refresh).digest('hex');
      await this.prisma.refreshToken.updateMany({
        where: { userId: req.user.sub, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    for (const [name, path] of [['access_token', '/'], ['refresh_token', '/api/auth/refresh'], ['csrf_token', '/']]) {
      response.clearCookie(name, { path, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    }
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtGuard)
  async me(@Req() req: AuthRequest) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: req.user.sub },
      select: { id: true, email: true, role: true, sellerProfile: { select: { codeBalance: true, isVerified: true, slug: true, displayName: true } } },
    });
  }

  private async verifyTurnstile(token: string) {
    if (!process.env.TURNSTILE_SECRET_KEY) {
      if (process.env.NODE_ENV === 'production') throw new UnauthorizedException('Bot protection is not configured');
      return;
    }
    const form = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const json = (await result.json()) as { success?: boolean };
    if (!json.success) throw new UnauthorizedException('Turnstile verification failed');
  }
}
