/**
 * Component Type Definitions
 * 
 * This file contains TypeScript types for UI component variants and props.
 * These types ensure consistency across all design system components.
 */

/**
 * Button variant types
 * Defines the supported button styles
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'destructive' | 'default'

/**
 * Component size types
 * Used across multiple components (Button, Input, etc.)
 */
export type ComponentSize = 'sm' | 'md' | 'lg' | 'icon'

/**
 * Shadow size types
 * Used for Card and other elevated components
 */
export type ShadowSize = 'sm' | 'md' | 'lg'

/**
 * Padding size types
 * Used for Card and container components
 */
export type PaddingSize = 'sm' | 'md' | 'lg'

/**
 * Variant configuration helper type
 * Maps variant names to their corresponding CSS classes
 * 
 * @template T - The variant type (e.g., ButtonVariant, ComponentSize)
 */
export interface VariantConfig<T extends string> {
  [key: string]: Record<T, string>
}

/**
 * Base component props that all design system components should extend
 */
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}
