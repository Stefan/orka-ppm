/**
 * Validation System for editable fields
 * Requirements: 7.5
 */

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom'
  value?: unknown
  message: string
  validator?: (value: unknown) => boolean
}

export interface ValidationResult {
  valid: boolean
  message?: string
}

export function validateField(value: unknown, rules: ValidationRule[]): ValidationResult {
  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        if (value == null || (typeof value === 'string' && value.trim() === ''))
          return { valid: false, message: rule.message }
        break
      case 'min':
        if (typeof value === 'number' && value < Number(rule.value))
          return { valid: false, message: rule.message }
        if (typeof value === 'string' && value.length < Number(rule.value))
          return { valid: false, message: rule.message }
        break
      case 'max':
        if (typeof value === 'number' && value > Number(rule.value))
          return { valid: false, message: rule.message }
        if (typeof value === 'string' && value.length > Number(rule.value))
          return { valid: false, message: rule.message }
        break
      case 'pattern':
        if (typeof value === 'string' && rule.value instanceof RegExp && !rule.value.test(value))
          return { valid: false, message: rule.message }
        break
      case 'custom':
        if (rule.validator && !rule.validator(value))
          return { valid: false, message: rule.message }
        break
    }
  }
  return { valid: true }
}
