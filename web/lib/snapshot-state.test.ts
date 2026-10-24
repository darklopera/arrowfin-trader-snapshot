import { describe, expect, it } from 'vitest';
import { shouldApply } from './snapshot-state';
import type { Snapshot } from './types';

const snap = (version: number) => ({ version }) as Snapshot;

describe('shouldApply', () => {
  it('applies when we have nothing yet', () => expect(shouldApply(undefined, { version: 5 })).toBe(true));
  it('applies a newer version', () => expect(shouldApply(snap(10), { version: 11 })).toBe(true));
  it('applies a newer version even after a gap (state, not delta)', () => expect(shouldApply(snap(10), { version: 14 })).toBe(true));
  it('ignores a duplicate', () => expect(shouldApply(snap(10), { version: 10 })).toBe(false));
  it('ignores an out-of-order older event', () => expect(shouldApply(snap(10), { version: 8 })).toBe(false));
});
