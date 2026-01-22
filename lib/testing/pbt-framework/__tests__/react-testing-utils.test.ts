/**
 * Tests for React Testing Utilities
 * 
 * Validates React component testing support with various prop combinations
 * and async operation testing capabilities.
 * 
 * **Feature: property-based-testing**
 * **Property 12: React Component Behavior Validation**
 * **Property 13: Async Operation Testing Support**
 * **Validates: Requirements 3.3, 3.5**
 */

import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import React from 'react';
import {
  generateBooleanPropCombinations,
  propCombinationGenerator,
  optionalPropGenerator,
  testComponentRenders,
  asyncStateGenerator,
  testAsyncOperation,
  asyncOperationSequenceGenerator,
  stateTransitionGenerator,
  testStateTransitions,
  testStateInvariants,
  reactTestingUtils,
} from '../react-testing-utils';

describe('React Testing Utilities', () => {
  describe('Property 12: React Component Behavior Validation', () => {
    /**
     * Property 12: React Component Behavior Validation
     * For any React component tested with different prop combinations,
     * the component must behave correctly and maintain expected functionality
     * **Validates: Requirements 3.3**
     */

    describe('Prop Combination Generators', () => {
      it('should generate all boolean prop combinations', () => {
        const combinations = generateBooleanPropCombinations(['isLoading', 'isError', 'isDisabled']);

        // Should generate 2^3 = 8 combinations
        expect(combinations.length).toBe(8);

        // Should include all false combination
        expect(combinations).toContainEqual({
          isLoading: false,
          isError: false,
          isDisabled: false,
        });

        // Should include all true combination
        expect(combinations).toContainEqual({
          isLoading: true,
          isError: true,
          isDisabled: true,
        });

        // All combinations should have all props
        combinations.forEach((combo) => {
          expect(combo).toHaveProperty('isLoading');
          expect(combo).toHaveProperty('isError');
          expect(combo).toHaveProperty('isDisabled');
        });
      });

      it('should generate prop combinations with fast-check', () => {
        const propsArbitrary = propCombinationGenerator({
          title: fc.string({ minLength: 1, maxLength: 50 }),
          count: fc.integer({ min: 0, max: 100 }),
          isActive: fc.boolean(),
        });

        fc.assert(
          fc.property(propsArbitrary, (props) => {
            expect(props).toHaveProperty('title');
            expect(props).toHaveProperty('count');
            expect(props).toHaveProperty('isActive');

            expect(typeof props.title).toBe('string');
            expect(typeof props.count).toBe('number');
            expect(typeof props.isActive).toBe('boolean');

            expect(props.title.length).toBeGreaterThan(0);
            expect(props.count).toBeGreaterThanOrEqual(0);
            expect(props.count).toBeLessThanOrEqual(100);

            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should generate optional props with correct probability', () => {
        const propsArbitrary = optionalPropGenerator(
          {
            name: fc.string(),
            age: fc.integer(),
          },
          0.5 // 50% chance of undefined
        );

        let undefinedCount = 0;
        let definedCount = 0;

        fc.assert(
          fc.property(propsArbitrary, (props) => {
            if (props.name === undefined) undefinedCount++;
            else definedCount++;

            return true;
          }),
          { numRuns: 100 }
        );

        // With 50% probability, we should have some of each
        expect(undefinedCount).toBeGreaterThan(0);
        expect(definedCount).toBeGreaterThan(0);
      });
    });

    describe('Component Testing', () => {
      // Simple test component
      const TestButton: React.FC<{ label: string; disabled?: boolean }> = ({ label, disabled }) =>
        React.createElement('button', { disabled }, label);

      it('should test component renders with various props', () => {
        const propsGenerator = fc.record({
          label: fc.string({ minLength: 1, maxLength: 20 }),
          disabled: fc.boolean(),
        });

        testComponentRenders(TestButton, propsGenerator, { numRuns: 50 });
      });

      it('should validate component behavior with prop combinations', () => {
        const propsGenerator = fc.record({
          label: fc.string({ minLength: 1, maxLength: 20 }),
          disabled: fc.boolean(),
        });

        fc.assert(
          fc.property(propsGenerator, (props) => {
            const { container } = render(React.createElement(TestButton, props));
            const button = container.querySelector('button');

            expect(button).toBeInTheDocument();
            expect(button?.textContent).toBe(props.label);

            if (props.disabled) {
              expect(button).toBeDisabled();
            } else {
              expect(button).not.toBeDisabled();
            }

            return true;
          }),
          { numRuns: 50 }
        );
      });
    });
  });

  describe('Property 13: Async Operation Testing Support', () => {
    /**
     * Property 13: Async Operation Testing Support
     * For any async operation or state management logic test,
     * the testing system must properly handle asynchronous behavior and state transitions
     * **Validates: Requirements 3.5**
     */

    describe('Async State Generator', () => {
      it('should generate all async states', () => {
        const stateGenerator = asyncStateGenerator(fc.string());

        const generatedStates = new Set<string>();

        fc.assert(
          fc.property(stateGenerator, (state) => {
            generatedStates.add(state.status);

            // Validate state structure
            expect(['idle', 'loading', 'success', 'error']).toContain(state.status);

            if (state.status === 'success') {
              expect(state).toHaveProperty('data');
              expect(typeof state.data).toBe('string');
            }

            if (state.status === 'error') {
              expect(state).toHaveProperty('error');
              expect(state.error).toBeInstanceOf(Error);
            }

            return true;
          }),
          { numRuns: 200 }
        );

        // Should generate multiple different states
        expect(generatedStates.size).toBeGreaterThan(1);
      });
    });

    describe('Async Operation Testing', () => {
      it('should test successful async operations', async () => {
        const operation = async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'success';
        };

        await testAsyncOperation(
          operation,
          (result) => {
            expect(result).toBe('success');
          },
          { timeout: 1000 }
        );
      });

      it('should handle async operation timeout', async () => {
        const operation = async () => {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return 'success';
        };

        await expect(
          testAsyncOperation(operation, () => {}, { timeout: 100 })
        ).rejects.toThrow('Operation timeout');
      });

      it('should retry failed operations', async () => {
        let attempts = 0;

        const operation = async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return 'success';
        };

        await testAsyncOperation(
          operation,
          (result) => {
            expect(result).toBe('success');
          },
          { timeout: 1000, retries: 3 }
        );

        expect(attempts).toBe(3);
      });
    });

    describe('Async Operation Sequence Generator', () => {
      it('should generate realistic async operation sequences', () => {
        const sequenceGenerator = asyncOperationSequenceGenerator(fc.string());

        fc.assert(
          fc.property(sequenceGenerator, (sequence) => {
            expect(sequence.operations).toBeDefined();
            expect(Array.isArray(sequence.operations)).toBe(true);
            expect(sequence.operations.length).toBeGreaterThanOrEqual(1);
            expect(sequence.operations.length).toBeLessThanOrEqual(5);

            sequence.operations.forEach((op) => {
              expect(op.delay).toBeGreaterThanOrEqual(0);
              expect(op.delay).toBeLessThanOrEqual(1000);
              expect(['success', 'error']).toContain(op.result);
            });

            return true;
          }),
          { numRuns: 100 }
        );
      });
    });
  });

  describe('State Management Testing', () => {
    describe('State Transition Generator', () => {
      it('should generate valid state transitions', () => {
        const transitionGenerator = stateTransitionGenerator(
          fc.constantFrom('idle', 'loading', 'success', 'error'),
          fc.constantFrom('fetch', 'reset', 'retry')
        );

        fc.assert(
          fc.property(transitionGenerator, (transition) => {
            expect(transition).toHaveProperty('fromState');
            expect(transition).toHaveProperty('action');
            expect(transition).toHaveProperty('toState');

            expect(['idle', 'loading', 'success', 'error']).toContain(transition.fromState);
            expect(['idle', 'loading', 'success', 'error']).toContain(transition.toState);
            expect(['fetch', 'reset', 'retry']).toContain(transition.action);

            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('State Transition Testing', () => {
      // Simple counter reducer for testing
      type CounterState = { count: number };
      type CounterAction = { type: 'increment' } | { type: 'decrement' } | { type: 'reset' };

      const counterReducer = (state: CounterState, action: CounterAction): CounterState => {
        switch (action.type) {
          case 'increment':
            return { count: state.count + 1 };
          case 'decrement':
            return { count: Math.max(0, state.count - 1) };
          case 'reset':
            return { count: 0 };
          default:
            return state;
        }
      };

      it('should test state transitions', () => {
        const actionGenerator = fc.constantFrom<CounterAction>(
          { type: 'increment' },
          { type: 'decrement' },
          { type: 'reset' }
        );

        testStateTransitions(
          counterReducer,
          { count: 0 },
          actionGenerator,
          (state, action, newState) => {
            // Validate transition logic
            if (action.type === 'increment') {
              expect(newState.count).toBe(state.count + 1);
            } else if (action.type === 'decrement') {
              expect(newState.count).toBe(Math.max(0, state.count - 1));
            } else if (action.type === 'reset') {
              expect(newState.count).toBe(0);
            }
          },
          { numRuns: 100 }
        );
      });

      it('should test state invariants', () => {
        const actionGenerator = fc.constantFrom<CounterAction>(
          { type: 'increment' },
          { type: 'decrement' },
          { type: 'reset' }
        );

        testStateInvariants(
          counterReducer,
          { count: 0 },
          actionGenerator,
          [
            {
              name: 'count is non-negative',
              check: (state) => state.count >= 0,
              message: 'Count should never be negative',
            },
            {
              name: 'count is finite',
              check: (state) => Number.isFinite(state.count),
              message: 'Count should always be a finite number',
            },
          ],
          { numRuns: 100 }
        );
      });

      it('should detect invariant violations', () => {
        // Buggy reducer that violates invariants
        const buggyReducer = (state: CounterState, action: CounterAction): CounterState => {
          if (action.type === 'decrement') {
            return { count: state.count - 1 }; // Bug: allows negative
          }
          return counterReducer(state, action);
        };

        const actionGenerator = fc.constantFrom<CounterAction>(
          { type: 'increment' },
          { type: 'decrement' },
          { type: 'reset' }
        );

        expect(() => {
          testStateInvariants(
            buggyReducer,
            { count: 0 },
            actionGenerator,
            [
              {
                name: 'count is non-negative',
                check: (state) => state.count >= 0,
              },
            ],
            { numRuns: 100 }
          );
        }).toThrow(); // Just check that it throws, don't check the exact message
      });
    });
  });

  describe('React Testing Utils Object', () => {
    it('should provide all utilities through reactTestingUtils object', () => {
      expect(reactTestingUtils.generateBooleanPropCombinations).toBeDefined();
      expect(reactTestingUtils.propCombinationGenerator).toBeDefined();
      expect(reactTestingUtils.optionalPropGenerator).toBeDefined();
      expect(reactTestingUtils.testComponentWithProps).toBeDefined();
      expect(reactTestingUtils.testComponentRenders).toBeDefined();
      expect(reactTestingUtils.asyncStateGenerator).toBeDefined();
      expect(reactTestingUtils.testAsyncOperation).toBeDefined();
      expect(reactTestingUtils.asyncOperationSequenceGenerator).toBeDefined();
      expect(reactTestingUtils.stateTransitionGenerator).toBeDefined();
      expect(reactTestingUtils.testStateTransitions).toBeDefined();
      expect(reactTestingUtils.testStateInvariants).toBeDefined();
      expect(reactTestingUtils.testHookWithInputs).toBeDefined();
    });
  });
});
