/**
 * Chart calculation worker for complex chart data processing
 */

self.onmessage = function(event) {
  const { taskId, type, data } = event.data

  try {
    let result

    switch (type) {
      case 'calculate':
        result = calculateChartData(data.data, data.chartType, data.options)
        break
      
      case 'aggregate-timeseries':
        result = aggregateTimeSeries(data.data, data.timeField, data.valueField, data.interval)
        break
      
      case 'calculate-moving-average':
        result = calculateMovingAverage(data.data, data.field, data.window)
        break
      
      case 'calculate-percentiles':
        result = calculatePercentiles(data.data, data.field, data.percentiles)
        break
      
      case 'detect-outliers':
        result = detectOutliers(data.data, data.field, data.method)
        break
      
      default:
        throw new Error(`Unknown calculation type: ${type}`)
    }

    self.postMessage({ taskId, result })
  } catch (error) {
    self.postMessage({ taskId, error: error.message })
  }
}

// Main chart data calculation
function calculateChartData(rawData, chartType, options = {}) {
  switch (chartType) {
    case 'line':
    case 'area':
      return calculateLineChartData(rawData, options)
    
    case 'bar':
    case 'column':
      return calculateBarChartData(rawData, options)
    
    case 'pie':
    case 'donut':
      return calculatePieChartData(rawData, options)
    
    case 'scatter':
      return calculateScatterChartData(rawData, options)
    
    case 'heatmap':
      return calculateHeatmapData(rawData, options)
    
    case 'histogram':
      return calculateHistogramData(rawData, options)
    
    default:
      throw new Error(`Unsupported chart type: ${chartType}`)
  }
}

// Line chart calculations
function calculateLineChartData(data, options) {
  const { xField, yField, groupBy } = options
  
  if (groupBy) {
    const groups = {}
    data.forEach(item => {
      const group = item[groupBy]
      if (!groups[group]) groups[group] = []
      groups[group].push({
        x: item[xField],
        y: item[yField]
      })
    })
    
    return Object.keys(groups).map(group => ({
      name: group,
      data: groups[group].sort((a, b) => a.x - b.x)
    }))
  }
  
  return [{
    name: 'Series 1',
    data: data.map(item => ({
      x: item[xField],
      y: item[yField]
    })).sort((a, b) => a.x - b.x)
  }]
}

// Bar chart calculations
function calculateBarChartData(data, options) {
  const { categoryField, valueField, aggregation = 'sum' } = options
  
  const categories = {}
  data.forEach(item => {
    const category = item[categoryField]
    if (!categories[category]) categories[category] = []
    categories[category].push(item[valueField])
  })
  
  return Object.keys(categories).map(category => {
    const values = categories[category]
    let value
    
    switch (aggregation) {
      case 'sum':
        value = values.reduce((sum, v) => sum + v, 0)
        break
      case 'avg':
        value = values.reduce((sum, v) => sum + v, 0) / values.length
        break
      case 'count':
        value = values.length
        break
      case 'min':
        value = Math.min(...values)
        break
      case 'max':
        value = Math.max(...values)
        break
      default:
        value = values.reduce((sum, v) => sum + v, 0)
    }
    
    return {
      category,
      value
    }
  })
}

// Pie chart calculations
function calculatePieChartData(data, options) {
  const { labelField, valueField } = options
  
  const total = data.reduce((sum, item) => sum + item[valueField], 0)
  
  return data.map(item => ({
    label: item[labelField],
    value: item[valueField],
    percentage: (item[valueField] / total) * 100
  }))
}

// Scatter chart calculations
function calculateScatterChartData(data, options) {
  const { xField, yField, sizeField, colorField } = options
  
  return data.map(item => ({
    x: item[xField],
    y: item[yField],
    size: sizeField ? item[sizeField] : 1,
    color: colorField ? item[colorField] : 'default'
  }))
}

// Heatmap calculations
function calculateHeatmapData(data, options) {
  const { xField, yField, valueField } = options
  
  const matrix = {}
  data.forEach(item => {
    const x = item[xField]
    const y = item[yField]
    
    if (!matrix[y]) matrix[y] = {}
    matrix[y][x] = item[valueField]
  })
  
  const result = []
  Object.keys(matrix).forEach(y => {
    Object.keys(matrix[y]).forEach(x => {
      result.push({
        x,
        y,
        value: matrix[y][x]
      })
    })
  })
  
  return result
}

// Histogram calculations
function calculateHistogramData(data, options) {
  const { field, bins = 10 } = options
  
  const values = data.map(item => item[field]).filter(v => v !== null && v !== undefined)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const binWidth = (max - min) / bins
  
  const histogram = new Array(bins).fill(0)
  const binLabels = []
  
  for (let i = 0; i < bins; i++) {
    const binStart = min + i * binWidth
    const binEnd = min + (i + 1) * binWidth
    binLabels.push(`${binStart.toFixed(1)}-${binEnd.toFixed(1)}`)
  }
  
  values.forEach(value => {
    const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1)
    histogram[binIndex]++
  })
  
  return histogram.map((count, index) => ({
    bin: binLabels[index],
    count
  }))
}

// Time series aggregation
function aggregateTimeSeries(data, timeField, valueField, interval) {
  const intervals = {}
  
  data.forEach(item => {
    const time = new Date(item[timeField])
    let intervalKey
    
    switch (interval) {
      case 'hour':
        intervalKey = new Date(time.getFullYear(), time.getMonth(), time.getDate(), time.getHours()).toISOString()
        break
      case 'day':
        intervalKey = new Date(time.getFullYear(), time.getMonth(), time.getDate()).toISOString()
        break
      case 'week':
        const weekStart = new Date(time)
        weekStart.setDate(time.getDate() - time.getDay())
        intervalKey = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()).toISOString()
        break
      case 'month':
        intervalKey = new Date(time.getFullYear(), time.getMonth(), 1).toISOString()
        break
      default:
        intervalKey = time.toISOString()
    }
    
    if (!intervals[intervalKey]) intervals[intervalKey] = []
    intervals[intervalKey].push(item[valueField])
  })
  
  return Object.keys(intervals).sort().map(key => ({
    time: key,
    value: intervals[key].reduce((sum, v) => sum + v, 0),
    count: intervals[key].length,
    average: intervals[key].reduce((sum, v) => sum + v, 0) / intervals[key].length
  }))
}

// Moving average calculation
function calculateMovingAverage(data, field, window) {
  const values = data.map(item => item[field])
  const movingAverages = []
  
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1)
    const windowValues = values.slice(start, i + 1)
    const average = windowValues.reduce((sum, v) => sum + v, 0) / windowValues.length
    movingAverages.push(average)
  }
  
  return data.map((item, index) => ({
    ...item,
    movingAverage: movingAverages[index]
  }))
}

// Percentile calculations
function calculatePercentiles(data, field, percentiles) {
  const values = data.map(item => item[field]).sort((a, b) => a - b)
  const result = {}
  
  percentiles.forEach(p => {
    const index = (p / 100) * (values.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index - lower
    
    result[`p${p}`] = values[lower] * (1 - weight) + values[upper] * weight
  })
  
  return result
}

// Outlier detection
function detectOutliers(data, field, method = 'iqr') {
  const values = data.map(item => item[field]).sort((a, b) => a - b)
  let outliers = []
  
  if (method === 'iqr') {
    const q1Index = Math.floor(values.length * 0.25)
    const q3Index = Math.floor(values.length * 0.75)
    const q1 = values[q1Index]
    const q3 = values[q3Index]
    const iqr = q3 - q1
    const lowerBound = q1 - 1.5 * iqr
    const upperBound = q3 + 1.5 * iqr
    
    outliers = data.filter(item => {
      const value = item[field]
      return value < lowerBound || value > upperBound
    })
  } else if (method === 'zscore') {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)
    
    outliers = data.filter(item => {
      const zScore = Math.abs((item[field] - mean) / stdDev)
      return zScore > 3
    })
  }
  
  return {
    outliers,
    count: outliers.length,
    percentage: (outliers.length / data.length) * 100
  }
}