import { describe, expect, it } from 'vitest';
import { isSupportedNodeVersion } from '../src/lib/runtime';

describe('node version checks', () => {
  it('rejects Node 22 and earlier for SQLite-backed features', () => {
    expect(isSupportedNodeVersion('22.12.0')).toBe(false);
  });

  it('accepts Node 24 and later', () => {
    expect(isSupportedNodeVersion('24.0.0')).toBe(true);
  });
});
