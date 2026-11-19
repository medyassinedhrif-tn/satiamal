import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (!['POST', 'PATCH', 'DELETE'].includes(request.method)) return true;
    const header = request.header('x-csrf-token') ?? '';
    const cookie = request.cookies?.csrf_token ?? '';
    const left = Buffer.from(header);
    const right = Buffer.from(cookie);
    if (!left.length || left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}
