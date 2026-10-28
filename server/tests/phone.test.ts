import { describe, expect, it } from 'vitest';
import { isEthiopianMobile, normalizeEthiopianPhone } from '../src/lib/phone.js';
import { sniffImageType } from '../src/lib/images.js';

describe('normalizeEthiopianPhone', () => {
  it.each([
    ['0911234567', '+251911234567'],
    ['0911 23 45 67', '+251911234567'],
    ['+251 911-234-567', '+251911234567'],
    ['251911234567', '+251911234567'],
    ['911234567', '+251911234567'],
    ['0712345678', '+251712345678'],
    ['0111234567', '+251111234567'],
  ])('normalizes %s', (input, expected) => expect(normalizeEthiopianPhone(input)).toBe(expected));

  it.each(['', '12345', '0811234567', '+1 202 555 0100', '09112345678', 'abc0911234567'])('rejects %s', (input) =>
    expect(normalizeEthiopianPhone(input)).toBeNull(),
  );

  it('identifies mobiles for WhatsApp links', () => {
    expect(isEthiopianMobile('+251911234567')).toBe(true);
    expect(isEthiopianMobile('+251111234567')).toBe(false);
  });
});

describe('sniffImageType', () => {
  it('detects real image signatures and rejects disguised files', () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
    expect(sniffImageType(Buffer.from('RIFF0000WEBPVP8 '))).toBe('webp');
    expect(sniffImageType(Buffer.from('<?php echo 1; ?>'))).toBeNull();
    expect(sniffImageType(Buffer.from('MZ\x90\x00'))).toBeNull();
  });
});
