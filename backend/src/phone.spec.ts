import { BadRequestException } from '@nestjs/common';
import { normalizeTunisianPhone } from './auth/phone.js';

describe('normalizeTunisianPhone', () => {
  it('normalizes local and international Tunisian mobile numbers', () => {
    expect(normalizeTunisianPhone(' 22 123 456 ')).toBe('21622123456');
    expect(normalizeTunisianPhone('+216 22-123-456')).toBe('21622123456');
    expect(normalizeTunisianPhone('0021622123456')).toBe('21622123456');
  });

  it('rejects invalid prefixes and non-mobile lengths', () => {
    expect(() => normalizeTunisianPhone('71234567')).toThrow(BadRequestException);
    expect(() => normalizeTunisianPhone('2212345')).toThrow(BadRequestException);
  });
});
