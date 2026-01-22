/**
 * Consistent data formatting utilities for AI-empowered PPM features
 * Ensures all numerical values and dates are formatted consistently across the application
 */

/**
 * Format currency values with consistent decimal places
 * @param value - The numerical value to format
 * @param currency - Currency code (default: 'USD')
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

/**
 * Format percentage values with consistent decimal places
 * @param value - The numerical value (0-1 or 0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @param isDecimal - Whether the value is in decimal form (0-1) or percentage form (0-100)
 * @returns Formatted percentage string
 */
export function formatPercentage(
  value: number,
  decimals: number = 1,
  isDecimal: boolean = true
): string {
  const percentValue = isDecimal ? value * 100 : value
  return `${percentValue.toFixed(decimals)}%`
}

/**
 * Format dates consistently as YYYY-MM-DD
 * @param date - Date object, string, or timestamp
 * @returns Formatted date string (YYYY-MM-DD)
 */
export function formatDate(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date

  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date'
  }

  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * Format datetime consistently as YYYY-MM-DD HH:MM:SS
 * @param date - Date object, string, or timestamp
 * @returns Formatted datetime string
 */
export function formatDateTime(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date

  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date'
  }

  const datePart = formatDate(dateObj)
  const hours = String(dateObj.getHours()).padStart(2, '0')
  const minutes = String(dateObj.getMinutes()).padStart(2, '0')
  const seconds = String(dateObj.getSeconds()).padStart(2, '0')

  return `${datePart} ${hours}:${minutes}:${seconds}`
}

/**
 * Format time consistently as HH:MM
 * @param date - Date object, string, or timestamp
 * @returns Formatted time string
 */
export function formatTime(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date

  if (isNaN(dateObj.getTime())) {
    return 'Invalid Time'
  }

  const hours = String(dateObj.getHours()).padStart(2, '0')
  const minutes = String(dateObj.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

/**
 * Format numbers with consistent thousand separators and decimal places
 * @param value - The numerical value to format
 * @param decimals - Number of decimal places (default: 0)
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted number string
 */
export function formatNumber(
  value: number,
  decimals: number = 0,
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}

/**
 * Format hours with consistent decimal places
 * @param hours - Number of hours
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted hours string
 */
export function formatHours(hours: number, decimals: number = 1): string {
  return `${hours.toFixed(decimals)}h`
}

/**
 * Format confidence scores consistently
 * @param confidence - Confidence value (0-1)
 * @returns Formatted confidence string with percentage
 */
export function formatConfidence(confidence: number): string {
  return formatPercentage(confidence, 0, true)
}

/**
 * Format large numbers with K, M, B suffixes
 * @param value - The numerical value to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted number string with suffix
 */
export function formatCompactNumber(value: number, decimals: number = 1): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(decimals)}B`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(decimals)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(decimals)}K`
  }
  return value.toFixed(decimals)
}

/**
 * Format duration in milliseconds to human-readable format
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`
  }
  return `${(ms / 3600000).toFixed(1)}h`
}

/**
 * Format file size in bytes to human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 * @param date - Date object, string, or timestamp
 * @returns Formatted relative time string
 */
export function formatRelativeTime(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date

  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date'
  }

  const now = new Date()
  const diffMs = now.getTime() - dateObj.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) {
    return 'just now'
  }
  if (diffMin < 60) {
    return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`
  }
  if (diffHour < 24) {
    return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`
  }
  if (diffDay < 7) {
    return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`
  }
  if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7)
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`
  }
  if (diffDay < 365) {
    const months = Math.floor(diffDay / 30)
    return `${months} month${months !== 1 ? 's' : ''} ago`
  }
  const years = Math.floor(diffDay / 365)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}

/**
 * Truncate text to a maximum length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 100)
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) {
    return text
  }
  return `${text.substring(0, maxLength - 3)}...`
}

/**
 * Format validation severity for display
 * @param severity - Severity level
 * @returns Formatted severity string
 */
export function formatSeverity(severity: string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase()
}
