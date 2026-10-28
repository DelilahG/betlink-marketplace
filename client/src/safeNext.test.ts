import { describe, expect, it } from 'vitest';
import { safeNext } from './pages/Auth';

describe('safeNext (post-login redirect)', () => {
  it.each(['/dashboard', '/properties/abc?x=1', '/rent?q=Bole', '/search%20page'])('allows same-site path %s', (p) =>
    expect(safeNext(p)).toBe(p),
  );
  it.each([
    null,
    '',
    'https://evil.com',
    '//evil.com',
    '/\\evil.com', // browsers normalise "/\" to "//" -> protocol-relative URL
    '/\\/evil.com',
    '\\\\evil.com',
    'javascript:alert(1)',
    '/a\nb',
  ])('rejects %j', (p) => expect(safeNext(p)).toBeNull());
});
