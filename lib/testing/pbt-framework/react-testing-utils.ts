/**
 * React Component Testing Utilities for Property-Based Testing
 * 
 * Provides utilities for testing React components with property-based testing:
 * - Prop combination generators
 * - Component behavior validation
 * - Async operation testing
 * - State management testing
 * 
 * **Feature: property-based-testing**
 * **Validates: Requirements 3.3, 3.5**
 */

import * as fc from 'fast-check';
import { render, RenderResult, waitFor, act } from '@testing-library/react';
import * as React from 'react';
import { ReactElement } from 'react';

// ============================================================================
// Prop Combination Generators
// ============================================================================

/**
 * Generates all combinations of boolean props
 * Useful for testing components with multiple boolean flags
 * 
 * @example
 * ```typescript
 * const propCombos = generateBooleanPropCombinations(['isLoading', 'isError', 'isDisabled']);
 * // Returns: [
 * //   { isLoading: false, isError: false, isDisabled: false },
 * //   { isLoading: true, isError: false, isDisabled: false },
 * //   ...
 * // ]
 * ```
 */
export function generateBooleanPropCombinations<T extends string>(
  propNames: T[]
): Array<Record<T, boolean>> {
  const combinations: Array<Record<T, boolean>> = [];
  const numCombinations = Math.pow(2, propNames.length);

  for (let i = 0; i < numCombinations; i++) {
    const combo = {} as Record<T, boolean>;
    propNames.forEach((propName, index) => {
      combo[propName] = Boolean(i & (1 << index));
    });
    combinations.push(combo);
  }

  return combinations;
}

/**
 * Creates a fast-check arbitrary for prop combinations
 * 
 * @example
 * ```typescript
 * const propsArbitrary = propCombinationGenerator({
 *   title: fc.string({ minLength: 1, maxLength: 50 }),
 *   count: fc.integer({ min: 0, max: 100 }),
 *   isActive: fc.boolean(),
 * });
 * ```
 */
export function propCombinationGenerator<T extends Record<string, any>>(
  propGenerators: { [K in keyof T]: fc.Arbitrary<T[K]> }
): fc.Arbitrary<T> {
  return fc.record(propGenerators);
}

/**
 * Creates a generator for optional props
 * Each prop has a chance of being undefined
 */
export function optionalPropGenerator<T extends Record<string, any>>(
  propGenerators: { [K in keyof T]: fc.Arbitrary<T[K]> },
  undefinedProbability: number = 0.3
): fc.Arbitrary<Partial<T>> {
  const optionalGenerators = Object.entries(propGenerators).reduce(
    (acc, [key, generator]) => {
      acc[key as keyof T] = fc.option(generator as fc.Arbitrary<any>, {
        nil: undefined,
        freq: Math.floor(undefinedProbability * 100),
      });
      return acc;
    },
    {} as { [K in keyof T]: fc.Arbitrary<T[K] | undefined> }
  );

  return fc.record(optionalGenerators);
}

// ============================================================================
// Component Testing Helpers
// ============================================================================

/**
 * Test result for component property tests
 */
export interface ComponentTestResult {
  rendered: boolean;
  error?: Error;
  renderResult?: RenderResult;
}

/**
 * Tests a React component with generated props
 * 
 * @param Component - React component to test
 * @param propsGenerator - fast-check arbitrary for props
 * @param assertions - Function to run assertions on the rendered component
 * @param options - Test options
 * 
 * @example
 * ```typescript
 * testComponentWithProps(
 *   MyButton,
 *   fc.record({ label: fc.string(), disabled: fc.boolean() }),
 *   (props, result) => {
 *     expect(result.getByRole('button')).toBeInTheDocument();
 *     if (props.disabled) {
 *       expect(result.getByRole('button')).toBeDisabled();
 *     }
 *   }
 * );
 * ```
 */
export function testComponentWithProps<P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  propsGenerator: fc.Arbitrary<P>,
  assertions: (props: P, result: RenderResult) => void | Promise<void>,
  options: { numRuns?: number; cleanup?: boolean } = {}
): void {
  const { numRuns = 100, cleanup = true } = options;

  fc.assert(
    fc.asyncProperty(propsGenerator, async (props) => {
      let result: RenderResult | undefined;

      try {
        result = render(React.createElement(Component, props));
        await assertions(props, result);
      } finally {
        if (cleanup && result) {
          result.unmount();
        }
      }
    }),
    { numRuns }
  );
}

/**
 * Tests that a component renders without errors for various prop combinations
 * 
 * @example
 * ```typescript
 * testComponentRenders(
 *   MyComponent,
 *   fc.record({ title: fc.string(), count: fc.integer() })
 * );
 * ```
 */
export function testComponentRenders<P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  propsGenerator: fc.Arbitrary<P>,
  options: { numRuns?: number } = {}
): void {
  testComponentWithProps(
    Component,
    propsGenerator,
    (props, result) => {
      expect(result.container).toBeInTheDocument();
    },
    options
  );
}

// ============================================================================
// Async Operation Testing
// ============================================================================

/**
 * Async operation state
 */
export type AsyncState<T, E = Error> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E };

/**
 * Generator for async operation states
 */
export function asyncStateGenerator<T>(
  dataGenerator: fc.Arbitrary<T>
): fc.Arbitrary<AsyncState<T>> {
  return fc.oneof(
    fc.constant({ status: 'idle' as const }),
    fc.constant({ status: 'loading' as const }),
    dataGenerator.map((data) => ({ status: 'success' as const, data })),
    fc.string().map((message) => ({
      status: 'error' as const,
      error: new Error(message),
    }))
  );
}

/**
 * Tests async operations with various states
 * 
 * @example
 * ```typescript
 * testAsyncOperation(
 *   async () => fetchData(),
 *   (result) => {
 *     expect(result).toBeDefined();
 *   },
 *   { timeout: 5000 }
 * );
 * ```
 */
export async function testAsyncOperation<T>(
  operation: () => Promise<T>,
  assertions: (result: T) => void | Promise<void>,
  options: { timeout?: number; retries?: number } = {}
): Promise<void> {
  const { timeout = 5000, retries = 0 } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), timeout)
        ),
      ]);

      await assertions(result);
      return; // Success
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries) {
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Generator for async operation sequences
 * Useful for testing state transitions
 */
export interface AsyncOperationSequence<T> {
  operations: Array<{
    delay: number;
    result: 'success' | 'error';
    data?: T;
    error?: string;
  }>;
}

export function asyncOperationSequenceGenerator<T>(
  dataGenerator: fc.Arbitrary<T>
): fc.Arbitrary<AsyncOperationSequence<T>> {
  return fc
    .array(
      fc.record({
        delay: fc.integer({ min: 0, max: 1000 }),
        result: fc.constantFrom('success' as const, 'error' as const),
        data: fc.option(dataGenerator, { nil: undefined }),
        error: fc.option(fc.string(), { nil: undefined }),
      }),
      { minLength: 1, maxLength: 5 }
    )
    .map((operations) => ({ operations }));
}

// ============================================================================
// State Management Testing
// ============================================================================

/**
 * State transition for testing state machines
 */
export interface StateTransition<S, A> {
  fromState: S;
  action: A;
  toState: S;
}

/**
 * Generates state transition sequences
 * 
 * @example
 * ```typescript
 * const transitions = stateTransitionGenerator(
 *   fc.constantFrom('idle', 'loading', 'success', 'error'),
 *   fc.constantFrom('fetch', 'reset', 'retry')
 * );
 * ```
 */
export function stateTransitionGenerator<S, A>(
  stateGenerator: fc.Arbitrary<S>,
  actionGenerator: fc.Arbitrary<A>
): fc.Arbitrary<StateTransition<S, A>> {
  return fc.record({
    fromState: stateGenerator,
    action: actionGenerator,
    toState: stateGenerator,
  });
}

/**
 * Tests state transitions in a reducer or state machine
 * 
 * @example
 * ```typescript
 * testStateTransitions(
 *   myReducer,
 *   initialState,
 *   actionGenerator,
 *   (state, action, newState) => {
 *     expect(newState).toBeDefined();
 *     // Add more assertions
 *   }
 * );
 * ```
 */
export function testStateTransitions<S, A>(
  reducer: (state: S, action: A) => S,
  initialState: S,
  actionGenerator: fc.Arbitrary<A>,
  assertions: (state: S, action: A, newState: S) => void | Promise<void>,
  options: { numRuns?: number } = {}
): void {
  const { numRuns = 100 } = options;

  fc.assert(
    fc.asyncProperty(fc.array(actionGenerator, { minLength: 1, maxLength: 10 }), async (actions) => {
      let currentState = initialState;

      for (const action of actions) {
        const newState = reducer(currentState, action);
        await assertions(currentState, action, newState);
        currentState = newState;
      }
    }),
    { numRuns }
  );
}

/**
 * State invariant checker
 * Validates that certain properties always hold true for a state
 */
export interface StateInvariant<S> {
  name: string;
  check: (state: S) => boolean;
  message?: string;
}

/**
 * Tests that state invariants hold across all transitions
 * 
 * @example
 * ```typescript
 * testStateInvariants(
 *   myReducer,
 *   initialState,
 *   actionGenerator,
 *   [
 *     {
 *       name: 'count is non-negative',
 *       check: (state) => state.count >= 0,
 *     },
 *   ]
 * );
 * ```
 */
export function testStateInvariants<S, A>(
  reducer: (state: S, action: A) => S,
  initialState: S,
  actionGenerator: fc.Arbitrary<A>,
  invariants: StateInvariant<S>[],
  options: { numRuns?: number } = {}
): void {
  const { numRuns = 100 } = options;

  fc.assert(
    fc.property(fc.array(actionGenerator, { minLength: 1, maxLength: 20 }), (actions) => {
      let currentState = initialState;

      // Check invariants on initial state
      for (const invariant of invariants) {
        if (!invariant.check(currentState)) {
          throw new Error(
            `Invariant "${invariant.name}" violated on initial state: ${
              invariant.message || 'No message provided'
            }`
          );
        }
      }

      // Apply actions and check invariants after each transition
      for (const action of actions) {
        currentState = reducer(currentState, action);

        for (const invariant of invariants) {
          if (!invariant.check(currentState)) {
            throw new Error(
              `Invariant "${invariant.name}" violated after action: ${
                invariant.message || 'No message provided'
              }`
            );
          }
        }
      }

      return true;
    }),
    { numRuns }
  );
}

// ============================================================================
// Hook Testing Utilities
// ============================================================================

/**
 * Tests a React hook with generated inputs
 * 
 * @example
 * ```typescript
 * testHookWithInputs(
 *   useCounter,
 *   fc.integer({ min: 0, max: 100 }),
 *   (initialValue, result) => {
 *     expect(result.current.count).toBe(initialValue);
 *   }
 * );
 * ```
 */
export function testHookWithInputs<I, R>(
  hook: (input: I) => R,
  inputGenerator: fc.Arbitrary<I>,
  assertions: (input: I, result: { current: R }) => void | Promise<void>,
  options: { numRuns?: number } = {}
): void {
  const { numRuns = 100 } = options;

  fc.assert(
    fc.asyncProperty(inputGenerator, async (input) => {
      // Note: This is a simplified version. In real usage, you'd use @testing-library/react-hooks
      // or similar to properly test hooks
      const result = { current: hook(input) };
      await assertions(input, result);
    }),
    { numRuns }
  );
}

// ============================================================================
// Export utilities
// ============================================================================

export const reactTestingUtils = {
  // Prop generators
  generateBooleanPropCombinations,
  propCombinationGenerator,
  optionalPropGenerator,

  // Component testing
  testComponentWithProps,
  testComponentRenders,

  // Async testing
  asyncStateGenerator,
  testAsyncOperation,
  asyncOperationSequenceGenerator,

  // State management
  stateTransitionGenerator,
  testStateTransitions,
  testStateInvariants,

  // Hook testing
  testHookWithInputs,
};
