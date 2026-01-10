/**
 * Data processing worker for CPU-intensive operations
 */

// Worker message handler
self.onmessage = function(event) {
  const { taskId, type, data } = event.data

  try {
    let result

    switch (type) {
      case 'filter':
        result = filterData(data.items, data.predicate)
        break
      
      case 'sort':
        result = sortData(data.items, data.compareFn, data.direction)
        break
      
      case 'aggregate':
        result = aggregateData(data.items, data.groupBy, data.aggregations)
        break
      
      case 'transform':
        result = transformData(data.items, data.transformFn)
        break
      
      case 'search':
        result = searchData(data.items, data.query, data.fields)
        break
      
      case 'validate':
        result = validateData(data.items, data.schema)
        break
      
      default:
        throw new Error(`Unknown task type: ${type}`)
    }

    self.postMessage({ taskId, result })
  } catch (error) {
    self.postMessage({ taskId, error: error.message })
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