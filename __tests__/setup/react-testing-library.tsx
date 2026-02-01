/**
 * React Testing Library custom render and utilities
 * Enterprise Test Strategy - Task 1.2
 * Requirements: 4.2, 4.4, 5.2
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

function AllTheProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, {
    wrapper: AllTheProviders,
    ...options,
  });
}

export * from '@testing-library/react';
export { customRender as render };
