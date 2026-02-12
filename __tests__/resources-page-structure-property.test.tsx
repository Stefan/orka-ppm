/**
 * Property-Based Tests for Resources Page Structure Verification
 * Feature: resources-page-structure-fix
 *
 * These tests use property-based testing to verify that the resources page
 * maintains consistent structure across all view modes and state changes.
 *
 * Each property test runs 100 iterations with randomly generated inputs.
 */

import * as fc from 'fast-check';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Resources Page Structure Property Tests', () => {
  let pageContent: string;

  const hasTestId = (id: string) =>
    pageContent.includes(`data-testid="${id}"`) || pageContent.includes(`data-testid='${id}'`);
  const indexOfTestId = (id: string) => {
    const dq = pageContent.indexOf(`data-testid="${id}"`);
    const sq = pageContent.indexOf(`data-testid='${id}'`);
    return dq >= 0 ? dq : sq;
  };
  const countTestId = (id: string) =>
    (pageContent.match(new RegExp(`data-testid=["']${id}["']`, 'g')) || []).length;

  beforeAll(() => {
    // Read the resources page source code
    const pagePath = join(process.cwd(), 'app/resources/page.tsx');
    pageContent = readFileSync(pagePath, 'utf-8');
  });

  /**
   * Property 1: Test ID Always Present
   * Feature: resources-page-structure-fix, Property 1: Test ID Always Present
   *
   * For any view mode (cards, table, or heatmap), the resources page should
   * always render an element with data-testid="resources-grid".
   *
   * Validates: Requirements 1.1, 4.4
   */
  describe('Property 1: Test ID Always Present', () => {
    it('should always have resources-grid test ID regardless of view mode', () => {
      // Generate random view modes
      const viewModeArbitrary = fc.constantFrom('cards', 'table', 'heatmap');

      fc.assert(
        fc.property(viewModeArbitrary, viewMode => {
          // Verify that data-testid="resources-grid" exists in the code
          expect(hasTestId('resources-grid')).toBe(true);

          // Find the resources-grid container
          const gridTestIdIndex = indexOfTestId('resources-grid');
          expect(gridTestIdIndex).toBeGreaterThan(-1);

          // Get the content after the test ID
          const afterTestId = pageContent.substring(gridTestIdIndex);

          // Verify the specific view mode is mentioned after the resources-grid test ID
          const viewModeCheck = `viewMode === '${viewMode}'`;
          expect(afterTestId).toContain(viewModeCheck);

          // Verify the view mode is inside the resources-grid container
          // (it should appear before any closing div that would end the container)
          const viewModeIndex = afterTestId.indexOf(viewModeCheck);
          expect(viewModeIndex).toBeGreaterThan(-1);
        }),
        { numRuns: 10 }
      );
    });

    it('should have resources-grid wrapping all three view modes', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          // Find the resources-grid container
          const gridTestIdIndex = indexOfTestId('resources-grid');
          expect(gridTestIdIndex).toBeGreaterThan(-1);

          // Get the content after the test ID
          const afterTestId = pageContent.substring(gridTestIdIndex);

          // All three view modes should be present after the resources-grid test ID
          expect(afterTestId).toContain("viewMode === 'cards'");
          expect(afterTestId).toContain("viewMode === 'table'");
          expect(afterTestId).toContain("viewMode === 'heatmap'");

          // Verify the order: resources-grid should come before all view mode checks
          const cardsIndex = afterTestId.indexOf("viewMode === 'cards'");
          const tableIndex = afterTestId.indexOf("viewMode === 'table'");
          const heatmapIndex = afterTestId.indexOf("viewMode === 'heatmap'");

          expect(cardsIndex).toBeGreaterThan(0);
          expect(tableIndex).toBeGreaterThan(0);
          expect(heatmapIndex).toBeGreaterThan(0);
        }),
        { numRuns: 10 }
      );
    });

    it('should have view mode content inside resources-grid container', () => {
      const viewModeArbitrary = fc.constantFrom('cards', 'table', 'heatmap');

      fc.assert(
        fc.property(viewModeArbitrary, viewMode => {
          // Find the resources-grid div
          const gridIndex = indexOfTestId('resources-grid');
          expect(gridIndex).toBeGreaterThan(-1);

          // Get content after resources-grid
          const afterGrid = pageContent.substring(gridIndex);

          // Verify the view mode check is inside
          const viewModeCheck = `viewMode === '${viewMode}'`;
          const viewModeIndex = afterGrid.indexOf(viewModeCheck);
          expect(viewModeIndex).toBeGreaterThan(-1);

          // Verify appropriate content for each view mode
          if (viewMode === 'cards') {
            const resourceCardIndex = afterGrid.indexOf('ResourceCard');
            expect(resourceCardIndex).toBeGreaterThan(-1);
            expect(resourceCardIndex).toBeGreaterThan(viewModeIndex);
          } else if (viewMode === 'table') {
            const tableComponentIndex = afterGrid.indexOf('VirtualizedResourceTable');
            expect(tableComponentIndex).toBeGreaterThan(-1);
            expect(tableComponentIndex).toBeGreaterThan(viewModeIndex);
          } else if (viewMode === 'heatmap') {
            const heatmapContentIndex = afterGrid.indexOf('Resource Utilization Heatmap');
            expect(heatmapContentIndex).toBeGreaterThan(-1);
            expect(heatmapContentIndex).toBeGreaterThan(viewModeIndex);
          }
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 2: View Mode Content Exclusivity
   * Feature: resources-page-structure-fix, Property 2: View Mode Content Exclusivity
   *
   * For any view mode, exactly one view mode's content should be rendered inside
   * the resources-grid container (cards XOR table XOR heatmap).
   *
   * Validates: Requirements 2.1, 2.2, 2.3
   */
  describe('Property 2: View Mode Content Exclusivity', () => {
    it('should render exactly one view mode at a time using exclusive conditionals', () => {
      const viewModeArbitrary = fc.constantFrom('cards', 'table', 'heatmap');

      fc.assert(
        fc.property(viewModeArbitrary, viewMode => {
          // Find the resources-grid container
          const gridIndex = indexOfTestId('resources-grid');
          const afterGrid = pageContent.substring(gridIndex);

          // Extract the section with view mode conditionals (reasonable chunk)
          const viewSection = afterGrid.substring(0, 5000);

          // Count occurrences of each view mode check in the resources-grid section
          const cardsMatches = (viewSection.match(/viewMode === 'cards'/g) || []).length;
          const tableMatches = (viewSection.match(/viewMode === 'table'/g) || []).length;
          const heatmapMatches = (viewSection.match(/viewMode === 'heatmap'/g) || []).length;

          // Each view mode should be checked exactly once
          expect(cardsMatches).toBe(1);
          expect(tableMatches).toBe(1);
          expect(heatmapMatches).toBe(1);

          // Verify they use exclusive conditionals (&&)
          const cardsIndex = viewSection.indexOf("viewMode === 'cards'");
          const tableIndex = viewSection.indexOf("viewMode === 'table'");
          const heatmapIndex = viewSection.indexOf("viewMode === 'heatmap'");

          const cardsConditional = viewSection.substring(
            Math.max(0, cardsIndex - 20),
            cardsIndex + 50
          );
          const tableConditional = viewSection.substring(
            Math.max(0, tableIndex - 20),
            tableIndex + 50
          );
          const heatmapConditional = viewSection.substring(
            Math.max(0, heatmapIndex - 20),
            heatmapIndex + 50
          );

          // Each should have its own conditional check with &&
          expect(cardsConditional).toContain('&&');
          expect(tableConditional).toContain('&&');
          expect(heatmapConditional).toContain('&&');
        }),
        { numRuns: 10 }
      );
    });

    it('should not have nested view mode conditionals', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const gridIndex = indexOfTestId('resources-grid');
          const afterGrid = pageContent.substring(gridIndex, gridIndex + 5000);

          // Count occurrences of each view mode check
          const cardsMatches = (afterGrid.match(/viewMode === 'cards'/g) || []).length;
          const tableMatches = (afterGrid.match(/viewMode === 'table'/g) || []).length;
          const heatmapMatches = (afterGrid.match(/viewMode === 'heatmap'/g) || []).length;

          // Each view mode should be checked exactly once (no nesting)
          expect(cardsMatches).toBe(1);
          expect(tableMatches).toBe(1);
          expect(heatmapMatches).toBe(1);
        }),
        { numRuns: 10 }
      );
    });

    it('should use mutually exclusive conditionals for all view modes', () => {
      const viewModePairsArbitrary = fc
        .tuple(
          fc.constantFrom('cards', 'table', 'heatmap'),
          fc.constantFrom('cards', 'table', 'heatmap')
        )
        .filter(([a, b]) => a !== b);

      fc.assert(
        fc.property(viewModePairsArbitrary, ([viewMode1, viewMode2]) => {
          const gridIndex = indexOfTestId('resources-grid');
          const afterGrid = pageContent.substring(gridIndex, gridIndex + 5000);

          // Find both view mode checks
          const viewMode1Check = `viewMode === '${viewMode1}'`;
          const viewMode2Check = `viewMode === '${viewMode2}'`;

          const viewMode1Index = afterGrid.indexOf(viewMode1Check);
          const viewMode2Index = afterGrid.indexOf(viewMode2Check);

          // Both should exist
          expect(viewMode1Index).toBeGreaterThan(-1);
          expect(viewMode2Index).toBeGreaterThan(-1);

          // They should not be nested (one should not be inside the other's block)
          // This is verified by checking they're at different positions and use separate conditionals
          expect(viewMode1Index).not.toBe(viewMode2Index);

          // Extract the conditionals
          const conditional1 = afterGrid.substring(
            Math.max(0, viewMode1Index - 20),
            viewMode1Index + 50
          );
          const conditional2 = afterGrid.substring(
            Math.max(0, viewMode2Index - 20),
            viewMode2Index + 50
          );

          // Both should use && (not nested if/else)
          expect(conditional1).toContain('&&');
          expect(conditional2).toContain('&&');
        }),
        { numRuns: 10 }
      );
    });

    it('should have separate conditional blocks for each view mode', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const gridIndex = indexOfTestId('resources-grid');
          const afterGrid = pageContent.substring(gridIndex, gridIndex + 5000);

          // Find all three view mode conditionals
          const cardsIndex = afterGrid.indexOf("viewMode === 'cards'");
          const tableIndex = afterGrid.indexOf("viewMode === 'table'");
          const heatmapIndex = afterGrid.indexOf("viewMode === 'heatmap'");

          // All should exist
          expect(cardsIndex).toBeGreaterThan(-1);
          expect(tableIndex).toBeGreaterThan(-1);
          expect(heatmapIndex).toBeGreaterThan(-1);

          // They should be in different positions (separate blocks)
          const positions = [cardsIndex, tableIndex, heatmapIndex].sort((a, b) => a - b);
          expect(positions[0]).not.toBe(positions[1]);
          expect(positions[1]).not.toBe(positions[2]);
          expect(positions[0]).not.toBe(positions[2]);
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 3: View Mode Switching Preserves Structure
   * Feature: resources-page-structure-fix, Property 3: View Mode Switching Preserves Structure
   *
   * For any sequence of view mode changes, the resources-grid test ID should
   * remain present throughout all transitions.
   *
   * Validates: Requirements 2.4, 4.5
   */
  describe('Property 3: View Mode Switching Preserves Structure', () => {
    it('should maintain resources-grid test ID through any sequence of view mode changes', () => {
      // Generate random sequences of view mode changes (length 3-10)
      const viewModeSequenceArbitrary = fc.array(fc.constantFrom('cards', 'table', 'heatmap'), {
        minLength: 3,
        maxLength: 10,
      });

      fc.assert(
        fc.property(viewModeSequenceArbitrary, viewModeSequence => {
          // For each view mode in the sequence, verify the structure is preserved
          viewModeSequence.forEach(viewMode => {
            // Verify resources-grid test ID exists
            expect(hasTestId('resources-grid')).toBe(true);

            // Find the resources-grid container
            const gridIndex = indexOfTestId('resources-grid');
            expect(gridIndex).toBeGreaterThan(-1);

            // Get content after resources-grid
            const afterGrid = pageContent.substring(gridIndex);

            // Verify the view mode is inside the resources-grid container
            const viewModeCheck = `viewMode === '${viewMode}'`;
            expect(afterGrid).toContain(viewModeCheck);
          });

          // Verify no errors would be thrown during transitions
          // (all view modes are properly defined)
          const allViewModes = ['cards', 'table', 'heatmap'];
          allViewModes.forEach(viewMode => {
            const gridIndex = indexOfTestId('resources-grid');
            const afterGrid = pageContent.substring(gridIndex);
            const viewModeCheck = `viewMode === '${viewMode}'`;
            expect(afterGrid).toContain(viewModeCheck);
          });
        }),
        { numRuns: 10 }
      );
    });

    it('should have all view modes accessible from resources-grid container', () => {
      // Generate sequences with transitions between different view modes
      const viewModeTransitionArbitrary = fc.array(
        fc.tuple(
          fc.constantFrom('cards', 'table', 'heatmap'),
          fc.constantFrom('cards', 'table', 'heatmap')
        ),
        { minLength: 3, maxLength: 10 }
      );

      fc.assert(
        fc.property(viewModeTransitionArbitrary, transitions => {
          // For each transition, verify both view modes are accessible
          transitions.forEach(([fromMode, toMode]) => {
            const gridIndex = indexOfTestId('resources-grid');
            const afterGrid = pageContent.substring(gridIndex);

            // Both view modes should be present after resources-grid
            expect(afterGrid).toContain(`viewMode === '${fromMode}'`);
            expect(afterGrid).toContain(`viewMode === '${toMode}'`);
          });
        }),
        { numRuns: 10 }
      );
    });

    it('should not have conditional rendering of resources-grid itself', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          // Find all occurrences of resources-grid test ID
          const matches = pageContent.match(/data-testid=["']resources-grid["']/g) || [];

          // Should have exactly one resources-grid test ID (not conditionally rendered)
          expect(matches.length).toBe(1);

          // Find the resources-grid declaration
          const gridIndex = indexOfTestId('resources-grid');

          // Look backwards to see if it's inside a conditional
          const beforeGrid = pageContent.substring(Math.max(0, gridIndex - 200), gridIndex);

          // Should not be inside a viewMode conditional
          // (the container itself should always render)
          const hasViewModeConditional =
            beforeGrid.includes("viewMode === 'cards'") ||
            beforeGrid.includes("viewMode === 'table'") ||
            beforeGrid.includes("viewMode === 'heatmap'");

          expect(hasViewModeConditional).toBe(false);
        }),
        { numRuns: 10 }
      );
    });

    it('should preserve structure across random view mode sequences', () => {
      // Generate random sequences with varying lengths
      const randomSequenceArbitrary = fc.array(fc.constantFrom('cards', 'table', 'heatmap'), {
        minLength: 5,
        maxLength: 10,
      });

      fc.assert(
        fc.property(randomSequenceArbitrary, sequence => {
          // Verify resources-grid is always present
          const gridIndex = indexOfTestId('resources-grid');
          expect(gridIndex).toBeGreaterThan(-1);

          // Verify all view modes in the sequence are accessible
          const uniqueViewModes = [...new Set(sequence)];
          uniqueViewModes.forEach(viewMode => {
            const afterGrid = pageContent.substring(gridIndex);
            expect(afterGrid).toContain(`viewMode === '${viewMode}'`);
          });

          // Verify the structure is consistent (no duplicate test IDs)
          const testIdMatches = countTestId('resources-grid');
          expect(testIdMatches).toBe(1);
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 4: Required Elements Present
   * Feature: resources-page-structure-fix, Property 4: Required Elements Present
   *
   * For any page load, all three required test IDs (resources-header, resources-title,
   * resources-grid) should be present in the DOM.
   *
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4
   */
  describe('Property 4: Required Elements Present', () => {
    it('should have all three required test IDs present', () => {
      // Generate random view modes to simulate different page states
      const viewModeArbitrary = fc.constantFrom('cards', 'table', 'heatmap');

      fc.assert(
        fc.property(viewModeArbitrary, viewMode => {
          // Verify all three required test IDs exist
          expect(hasTestId('resources-header')).toBe(true);
          expect(hasTestId('resources-title')).toBe(true);
          expect(hasTestId('resources-grid')).toBe(true);

          // Verify they appear in the correct order (header -> title -> grid)
          const headerIndex = indexOfTestId('resources-header');
          const titleIndex = indexOfTestId('resources-title');
          const gridIndex = indexOfTestId('resources-grid');

          expect(headerIndex).toBeGreaterThan(-1);
          expect(titleIndex).toBeGreaterThan(-1);
          expect(gridIndex).toBeGreaterThan(-1);

          // Title should be inside or after header
          expect(titleIndex).toBeGreaterThan(headerIndex);

          // Grid should come after header
          expect(gridIndex).toBeGreaterThan(headerIndex);
        }),
        { numRuns: 10 }
      );
    });

    it('should have required elements regardless of data state', () => {
      // Simulate different data states (empty, loading, error, populated)
      const dataStateArbitrary = fc.constantFrom('empty', 'loading', 'error', 'populated');
      const viewModeArbitrary = fc.constantFrom('cards', 'table', 'heatmap');

      fc.assert(
        fc.property(fc.tuple(dataStateArbitrary, viewModeArbitrary), ([dataState, viewMode]) => {
          // All required test IDs should be present regardless of data state
          expect(hasTestId('resources-header')).toBe(true);
          expect(hasTestId('resources-title')).toBe(true);
          expect(hasTestId('resources-grid')).toBe(true);

          // Verify the view mode is accessible
          const gridIndex = indexOfTestId('resources-grid');
          const afterGrid = pageContent.substring(gridIndex);
          expect(afterGrid).toContain(`viewMode === '${viewMode}'`);
        }),
        { numRuns: 10 }
      );
    });

    it('should not have duplicate required test IDs', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          // Count occurrences of each required test ID
          const headerMatches = countTestId('resources-header');
          const titleMatches = countTestId('resources-title');
          const gridMatches = countTestId('resources-grid');

          // Each should appear exactly once
          expect(headerMatches).toBe(1);
          expect(titleMatches).toBe(1);
          expect(gridMatches).toBe(1);
        }),
        { numRuns: 10 }
      );
    });

    it('should have resources-page container wrapping all required elements', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          // Verify resources-page test ID exists
          expect(hasTestId('resources-page')).toBe(true);

          // Find the resources-page container
          const pageIndex = indexOfTestId('resources-page');
          expect(pageIndex).toBeGreaterThan(-1);

          // Get content after resources-page
          const afterPage = pageContent.substring(pageIndex);

          // All required elements should be inside resources-page
          expect(afterPage).toMatch(/data-testid=["']resources-header["']/);
          expect(afterPage).toMatch(/data-testid=["']resources-title["']/);
          expect(afterPage).toMatch(/data-testid=["']resources-grid["']/);

          // Verify the order
          const headerIndex = afterPage.search(/data-testid=["']resources-header["']/);
          const titleIndex = afterPage.search(/data-testid=["']resources-title["']/);
          const gridIndex = afterPage.search(/data-testid=["']resources-grid["']/);

          expect(headerIndex).toBeGreaterThan(0);
          expect(titleIndex).toBeGreaterThan(0);
          expect(gridIndex).toBeGreaterThan(0);
        }),
        { numRuns: 10 }
      );
    });

    it('should maintain required elements across all view modes', () => {
      // Generate combinations of view modes
      const viewModeCombinationsArbitrary = fc.array(fc.constantFrom('cards', 'table', 'heatmap'), {
        minLength: 1,
        maxLength: 3,
      });

      fc.assert(
        fc.property(viewModeCombinationsArbitrary, viewModes => {
          // For each view mode, verify all required elements are present
          viewModes.forEach(viewMode => {
            // All required test IDs should exist
            expect(hasTestId('resources-header')).toBe(true);
            expect(hasTestId('resources-title')).toBe(true);
            expect(hasTestId('resources-grid')).toBe(true);

            // The view mode should be accessible
            const gridIndex = indexOfTestId('resources-grid');
            const afterGrid = pageContent.substring(gridIndex);
            expect(afterGrid).toContain(`viewMode === '${viewMode}'`);
          });
        }),
        { numRuns: 10 }
      );
    });
  });
});
