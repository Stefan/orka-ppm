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

const VALID_ITEM_TYPES = ['tasks', 'registers', 'cost_registers'] as const

export interface NestedGridConfigValidationResult {
  valid: boolean
  message?: string
}

/**
 * Validates nested grid config before save (Admin Panel).
 * Requirements: 5.5
 */
export function validateNestedGridConfig(config: {
  sections: Array<{ itemType: string; columns: Array<{ field: string; headerName: string }> }>
  enableLinkedItems: boolean
}): NestedGridConfigValidationResult {
  if (!Array.isArray(config.sections))
    return { valid: false, message: 'Configuration must have a sections array.' }
  for (let i = 0; i < config.sections.length; i++) {
    const section = config.sections[i]
    if (!section || typeof section !== 'object')
      return { valid: false, message: `Section ${i + 1} is invalid.` }
    if (!VALID_ITEM_TYPES.includes(section.itemType as (typeof VALID_ITEM_TYPES)[number]))
      return { valid: false, message: `Section ${i + 1}: invalid itemType.` }
    if (!Array.isArray(section.columns) || section.columns.length === 0)
      return { valid: false, message: `Section ${i + 1}: at least one column is required.` }
    for (let j = 0; j < section.columns.length; j++) {
      const col = section.columns[j]
      if (!col?.field?.trim()) return { valid: false, message: `Section ${i + 1}, column ${j + 1}: field is required.` }
      if (!col?.headerName?.trim())
        return { valid: false, message: `Section ${i + 1}, column ${j + 1}: headerName is required.` }
    }
  }
  return { valid: true }
}
