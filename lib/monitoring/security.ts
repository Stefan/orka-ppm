/**
 * Security utilities for input validation, sanitization, and protection
 */

import { logger } from './logger'

interface SecurityConfig {
  maxInputLength: number
  allowedDomains: string[]
  blockedPatterns: RegExp[]
  rateLimitWindow: number
  rateLimitMax: number
}

class SecurityManager {
  private config: SecurityConfig = {
    maxInputLength: 10000,
    allowedDomains: ['localhost', 'orka-ppm.onrender.com'],
    blockedPatterns: [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
      /javascript:/gi, // JavaScript URLs
      /on\w+\s*=/gi, // Event handlers
      /data:text\/html/gi, // Data URLs with HTML
    ],
    rateLimitWindow: 60000, // 1 minute
    rateLimitMax: 100 // 100 requests per minute
  }

  private rateLimitMap = new Map<string, { count: number; resetTime: number }>()

  // Input validation and sanitization
  validateInput(input: string, maxLength?: number): { isValid: boolean; sanitized: string; errors: string[] } {
    const errors: string[] = []
    let sanitized = input

    // Length validation
    const limit = maxLength || this.config.maxInputLength
    if (input.length > limit) {
      errors.push(`Input exceeds maximum length of ${limit} characters`)
      sanitized = input.substring(0, limit)
    }

    // Pattern validation
    this.config.blockedPatterns.forEach((pattern, index) => {
      if (pattern.test(input)) {
        errors.push(`Input contains blocked pattern ${index + 1}`)
        sanitized = sanitized.replace(pattern, '')
      }
    })

    // HTML entity encoding for basic XSS protection
    sanitized = this.escapeHtml(sanitized)

    const isValid = errors.length === 0

    if (!isValid) {
      logger.warn('Input validation failed', { errors, originalLength: input.length })
    }

    return { isValid, sanitized, errors }
  }

  // HTML escaping to prevent XSS
  escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  // URL validation
  validateUrl(url: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    try {
      const urlObj = new URL(url)
      
      // Protocol validation
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        errors.push('Invalid protocol. Only HTTP and HTTPS are allowed')
      }

      // Domain validation
      const hostname = urlObj.hostname
      const isAllowedDomain = this.config.allowedDomains.some(domain => 
        hostname === domain || hostname.endsWith(`.${domain}`)
      )

      if (!isAllowedDomain && process.env.NODE_ENV === 'production') {
        errors.push(`Domain ${hostname} is not in the allowed list`)
      }

    } catch (e) {
      errors.push('Invalid URL format')
    }

    const isValid = errors.length === 0

    if (!isValid) {
      logger.warn('URL validation failed', { url, errors })
    }

    return { isValid, errors }
  }

  // Rate limiting
  checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const key = identifier
    const existing = this.rateLimitMap.get(key)

    if (!existing || now > existing.resetTime) {
      // New window or expired window
      const resetTime = now + this.config.rateLimitWindow
      this.rateLimitMap.set(key, { count: 1, resetTime })
      return { allowed: true, remaining: this.config.rateLimitMax - 1, resetTime }
    }

    if (existing.count >= this.config.rateLimitMax) {
      logger.warn('Rate limit exceeded', { identifier, count: existing.count })
      return { allowed: false, remaining: 0, resetTime: existing.resetTime }
    }

    existing.count++
    return { 
      allowed: true, 
      remaining: this.config.rateLimitMax - existing.count, 
      resetTime: existing.resetTime 
    }
  }

  // Content Security Policy helpers
  generateCSPNonce(): string {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  // Secure headers for API responses
  getSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    }
  }

  // Password strength validation
  validatePassword(password: string): { isValid: boolean; score: number; feedback: string[] } {
    const feedback: string[] = []
    let score = 0

    // Length check
    if (password.length >= 8) {
      score += 1
    } else {
      feedback.push('Password should be at least 8 characters long')
    }

    // Complexity checks
    if (/[a-z]/.test(password)) score += 1
    else feedback.push('Password should contain lowercase letters')

    if (/[A-Z]/.test(password)) score += 1
    else feedback.push('Password should contain uppercase letters')

    if (/\d/.test(password)) score += 1
    else feedback.push('Password should contain numbers')

    if (/[^a-zA-Z\d]/.test(password)) score += 1
    else feedback.push('Password should contain special characters')

    // Common password check (basic)
    const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein']
    if (commonPasswords.includes(password.toLowerCase())) {
      score = 0
      feedback.push('Password is too common')
    }

    const isValid = score >= 3 && feedback.length === 0

    return { isValid, score, feedback }
  }

  // JWT token validation (basic)
  validateJWTStructure(token: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!token) {
      errors.push('Token is required')
      return { isValid: false, errors }
    }

    const parts = token.split('.')
    if (parts.length !== 3) {
      errors.push('Invalid JWT structure')
      return { isValid: false, errors }
    }

    try {
      // Validate base64 encoding of header and payload
      JSON.parse(atob(parts[0]))
      JSON.parse(atob(parts[1]))
    } catch (e) {
      errors.push('Invalid JWT encoding')
    }

    return { isValid: errors.length === 0, errors }
  }

  // File upload validation
  validateFileUpload(file: File, allowedTypes: string[], maxSize: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Type validation
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`)
    }

    // Size validation
    if (file.size > maxSize) {
      errors.push(`File size ${file.size} exceeds maximum of ${maxSize} bytes`)
    }

    // Name validation
    if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
      errors.push('File name contains invalid characters')
    }

    const isValid = errors.length === 0

    if (!isValid) {
      logger.warn('File upload validation failed', { 
        fileName: file.name, 
        fileType: file.type, 
        fileSize: file.size, 
        errors 
      })
    }

    return { isValid, errors }
  }

  // Clean up rate limit map periodically
  cleanupRateLimit() {
    const now = Date.now()
    for (const [key, value] of this.rateLimitMap.entries()) {
      if (now > value.resetTime) {
        this.rateLimitMap.delete(key)
      }
    }
  }

  // Update security configuration
  updateConfig(newConfig: Partial<SecurityConfig>) {
    this.config = { ...this.config, ...newConfig }
    logger.info('Security configuration updated', { config: this.config })
  }
}

// Export singleton instance
export const security = new SecurityManager()

// Convenience exports
export const validateInput = (input: string, maxLength?: number) => security.validateInput(input, maxLength)
export const validateUrl = (url: string) => security.validateUrl(url)
export const checkRateLimit = (identifier: string) => security.checkRateLimit(identifier)
export const validatePassword = (password: string) => security.validatePassword(password)
export const escapeHtml = (unsafe: string) => security.escapeHtml(unsafe)

export default security