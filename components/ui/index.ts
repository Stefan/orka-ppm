/**
 * ORKA-PPM UI Components
 * Enhanced with atomic design system components
 */

// Existing components (enhanced)
export { Button } from './Button'
export { Input, Textarea } from './Input'
export { Card, CardHeader, CardContent, CardFooter } from './Card'
export { Modal, ModalFooter } from './Modal'
export { Select } from './Select'

// Atomic Design System Components
// Atoms - Basic building blocks
export {
  TouchButton,
  ResponsiveInput,
  SmartIcon,
  FlexibleTypography,
} from './atoms'

// Molecules - Simple combinations
export {
  ResponsiveContainer,
  AdaptiveGrid,
  InputGroup,
  SwipeableCard,
  LongPressMenu,
  PullToRefresh,
} from './molecules'

// Organisms - Complex combinations
export {
  AdaptiveDashboard,
  PinchZoomContainer,
} from './organisms'

// Re-export types
export type { 
  ButtonProps, 
  InputProps, 
  TextareaProps,
  CardProps,
  ModalProps,
  SelectProps,
  SelectOption,
} from '@/types'

export type {
  SmartIconProps,
  TypographyProps,
  InputGroupProps,
} from './atoms'

export type {
  AdaptiveDashboardProps,
  DashboardWidget,
} from './organisms'