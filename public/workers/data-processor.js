/**
 * Data processing worker for CPU-intensive operations.
 * predicate/compareFn/transformFn strings must come from app code only (function.toString());
 * do not pass user or API-supplied expressions (code injection risk).
 */

var DANGEROUS = /\.(constructor|__proto__|prototype)\b|require\s*\(|import\s*\(|eval\s*\(|Function\s*\(|process\.|globalThis\.|window\.|document\.|fetch\s*\(|XMLHttpRequest|\.cookie\b/i

function assertSafeFnStr(str) {
  if (typeof str !== 'string' || DANGEROUS.test(str)) {
    throw new Error('Invalid or disallowed expression')
  }
}

// Worker message handler
self.onmessage = function(event) {
  const { taskId, type, data } = event.data

  try {
    let result

    switch (type) {
      case 'filter':
        assertSafeFnStr(data.predicate)
        result = filterData(data.items, data.predicate)
        break
      
      case 'sort':
        assertSafeFnStr(data.compareFn)
        result = sortData(data.items, data.compareFn, data.direction)
        break
      
      case 'aggregate':
        result = aggregateData(data.items, data.groupBy, data.aggregations)
        break
      
      case 'transform':
        assertSafeFnStr(data.transformFn)
        result = transformData(data.items, data.transformFn)
        break
      
      case 'search':
        result = searchData(data.items, data.query, data.fields)
        break
      
      case 'validate':
        result = validateData(data.items, data.schema)
        break
      
      case 'batch-transform':
        result = batchTransform(data.items, data.operations)
        break
      
      case 'deduplicate':
        result = deduplicateData(data.items, data.keyFields)
        break
      
      case 'merge':
        result = mergeDatasets(data.datasets, data.mergeKey)
        break
      
      case 'pivot':
        result = pivotData(data.items, data.rowField, data.columnField, data.valueField)
        break
      
      case 'normalize':
        result = normalizeData(data.items, data.fields, data.method)
        break
      
      default:
        throw new Error(`Unknown task type: ${type}`)
    }

    self.postMessage({ taskId, result, success: true })
  } catch (error) {
    self.postMessage({ taskId, error: error.message, success: false })
  }
}

// Data filtering
function filterData(items, predicateStr) {
  const predicate = new Function('item', 'index', `return ${predicateStr}`)
  return items.filter(predicate)
}

// Data sorting
function sortData(items, compareFnStr, direction = 'asc') {
  const compareFn = new Function('a', 'b', `return ${compareFnStr}`)
  const sorted = [...items].sort(compareFn)
  return direction === 'desc' ? sorted.reverse() : sorted
}

// Data aggregation
function aggregateData(items, groupBy, aggregations) {
  const groups = {}
  
  // Group items
  items.forEach(item => {
    const key = typeof groupBy === 'function' ? groupBy(item) : item[groupBy]
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  })
  
  // Apply aggregations
  const result = {}
  Object.keys(groups).forEach(key => {
    const group = groups[key]
    result[key] = {}
    
    aggregations.forEach(agg => {
      switch (agg.type) {
        case 'count':
          result[key][agg.name] = group.length
          break
        case 'sum':
          result[key][agg.name] = group.reduce((sum, item) => sum + (item[agg.field] || 0), 0)
          break
        case 'avg':
          const sum = group.reduce((sum, item) => sum + (item[agg.field] || 0), 0)
          result[key][agg.name] = sum / group.length
          break
        case 'min':
          result[key][agg.name] = Math.min(...group.map(item => item[agg.field] || 0))
          break
        case 'max':
          result[key][agg.name] = Math.max(...group.map(item => item[agg.field] || 0))
          break
      }
    })
  })
  
  return result
}

// Data transformation
function transformData(items, transformFnStr) {
  const transformFn = new Function('item', 'index', `return ${transformFnStr}`)
  return items.map(transformFn)
}

// Data search
function searchData(items, query, fields) {
  const queryLower = query.toLowerCase()
  
  return items.filter(item => {
    return fields.some(field => {
      const value = item[field]
      if (typeof value === 'string') {
        return value.toLowerCase().includes(queryLower)
      }
      if (typeof value === 'number') {
        return value.toString().includes(query)
      }
      return false
    })
  })
}

// Data validation
function validateData(items, schema) {
  const errors = []
  
  items.forEach((item, index) => {
    Object.keys(schema).forEach(field => {
      const rule = schema[field]
      const value = item[field]
      
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({
          index,
          field,
          error: 'Field is required',
          value
        })
      }
      
      if (value !== undefined && value !== null && value !== '') {
        if (rule.type && typeof value !== rule.type) {
          errors.push({
            index,
            field,
            error: `Expected type ${rule.type}, got ${typeof value}`,
            value
          })
        }
        
        if (rule.min !== undefined && value < rule.min) {
          errors.push({
            index,
            field,
            error: `Value ${value} is less than minimum ${rule.min}`,
            value
          })
        }
        
        if (rule.max !== undefined && value > rule.max) {
          errors.push({
            index,
            field,
            error: `Value ${value} is greater than maximum ${rule.max}`,
            value
          })
        }
        
        if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
          errors.push({
            index,
            field,
            error: `Value does not match pattern ${rule.pattern}`,
            value
          })
        }
      }
    })
  })
  
  return {
    isValid: errors.length === 0,
    errors,
    validItems: items.length - errors.length
  }
}


// ============================================================================
// Additional Data Processing Functions
// ============================================================================

/**
 * Batch transform - apply multiple operations in sequence
 */
function batchTransform(items, operations) {
  let result = items
  
  operations.forEach(op => {
    switch (op.type) {
      case 'filter':
        result = filterData(result, op.predicate)
        break
      case 'sort':
        result = sortData(result, op.compareFn, op.direction)
        break
      case 'transform':
        result = transformData(result, op.transformFn)
        break
      case 'aggregate':
        result = aggregateData(result, op.groupBy, op.aggregations)
        break
    }
  })
  
  return result
}

/**
 * Deduplicate data based on key fields
 */
function deduplicateData(items, keyFields) {
  const seen = new Set()
  const result = []
  
  items.forEach(item => {
    const key = keyFields.map(field => item[field]).join('|')
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  })
  
  return result
}

/**
 * Merge multiple datasets on a common key
 */
function mergeDatasets(datasets, mergeKey) {
  if (datasets.length === 0) return []
  if (datasets.length === 1) return datasets[0]
  
  const merged = new Map()
  
  datasets.forEach((dataset, datasetIndex) => {
    dataset.forEach(item => {
      const key = item[mergeKey]
      if (!merged.has(key)) {
        merged.set(key, { [mergeKey]: key })
      }
      
      const mergedItem = merged.get(key)
      Object.keys(item).forEach(field => {
        if (field !== mergeKey) {
          const fieldName = datasets.length > 2 
            ? `${field}_${datasetIndex}` 
            : field
          mergedItem[fieldName] = item[field]
        }
      })
    })
  })
  
  return Array.from(merged.values())
}

/**
 * Pivot data from long to wide format
 */
function pivotData(items, rowField, columnField, valueField) {
  const pivoted = {}
  
  items.forEach(item => {
    const row = item[rowField]
    const column = item[columnField]
    const value = item[valueField]
    
    if (!pivoted[row]) {
      pivoted[row] = { [rowField]: row }
    }
    
    pivoted[row][column] = value
  })
  
  return Object.values(pivoted)
}

/**
 * Normalize data fields using various methods
 */
function normalizeData(items, fields, method = 'minmax') {
  const result = items.map(item => ({ ...item }))
  
  fields.forEach(field => {
    const values = items.map(item => item[field]).filter(v => typeof v === 'number')
    
    if (values.length === 0) return
    
    let normalized
    
    switch (method) {
      case 'minmax':
        const min = Math.min(...values)
        const max = Math.max(...values)
        const range = max - min
        
        if (range === 0) {
          normalized = values.map(() => 0)
        } else {
          normalized = values.map(v => (v - min) / range)
        }
        break
      
      case 'zscore':
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
        const stdDev = Math.sqrt(variance)
        
        if (stdDev === 0) {
          normalized = values.map(() => 0)
        } else {
          normalized = values.map(v => (v - mean) / stdDev)
        }
        break
      
      case 'decimal':
        const maxAbs = Math.max(...values.map(v => Math.abs(v)))
        
        if (maxAbs === 0) {
          normalized = values.map(() => 0)
        } else {
          normalized = values.map(v => v / maxAbs)
        }
        break
      
      default:
        normalized = values
    }
    
    let normalizedIndex = 0
    result.forEach(item => {
      if (typeof item[field] === 'number') {
        item[`${field}_normalized`] = normalized[normalizedIndex++]
      }
    })
  })
  
  return result
}
