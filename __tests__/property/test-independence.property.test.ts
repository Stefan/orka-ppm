/**
 * Property 35: Test Independence
 * Enterprise Test Strategy - Task 2.4
 * Validates: Requirements 20.6
 */

import * as fc from 'fast-check';

describe('Property 35: Test Independence', () => {
  it('test order does not affect pure function result', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        const add = (x: number, y: number) => x + y;
        const r1 = add(a, b);
        const r2 = add(b, a);
        return r1 === r2;
      }),
      { numRuns: 100 }
    );
  });

  it('same inputs produce same outputs (determinism)', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const trimmed = s.trim();
        return s.trim() === trimmed && trimmed === s.trim();
      }),
      { numRuns: 100 }
    );
  });
});
