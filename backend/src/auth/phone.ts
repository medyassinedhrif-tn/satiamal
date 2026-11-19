import { BadRequestException } from '@nestjs/common';

export function normalizeTunisianPhone(input: string): string {
  let value = input.replace(/[\s()+-]/g, '');
  if (value.startsWith('00')) value = value.slice(2);
  if (/^(2|4|5|9)\d{7}$/.test(value)) return `216${value}`;
  if (/^216(2|4|5|9)\d{7}$/.test(value)) return value;
  throw new BadRequestException('Enter a valid Tunisian mobile number');
}
