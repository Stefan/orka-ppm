/**
 * Monte Carlo simulation worker for CPU-intensive statistical calculations
 * Offloads heavy mathematical computations from the main thread
 */

// Worker message handler
self.onmessage = function(event) {
  const { taskId, type, data } = event.data

  try {
    let result

    switch (type) {
      case 'run-simulation':
        result = runMonteCarloSimulation(data)
        break
      
      case 'calculate-statistics':
        result = calculateStatistics(data.outcomes)
        break
      
      case 'calculate-percentiles':
        result = calculatePercentiles(data.outcomes, data.percentiles)
        break
      
      case 'calculate-risk-contributions':
        result = calculateRiskContributions(data.riskData)
        break
      
      case 'generate-distribution':
        result = generateDistribution(data.distributionType, data.parameters, data.samples)
        break
      
      default:
        throw new Error(`Unknown task type: ${type}`)
    }

    self.postMessage({ taskId, result, success: true })
  } catch (error) {
    self.postMessage({ 
      taskId, 
      error: error.message, 
      success: false 
    })
  }
}

/**
 * Run a complete Monte Carlo simulation
 */
function runMonteCarloSimulation(config) {
  const {
    risks,
    iterations = 10000,
    correlations = null,
    randomSeed = null,
    baselineCosts = {},
    scheduleData = null
  } = config

  // Set random seed if provided
  if (randomSeed !== null) {
    seedRandom(randomSeed)
  }

  // Initialize result arrays
  const costOutcomes = new Array(iterations)
  const scheduleOutcomes = new Array(iterations)
  const riskContributions = {}
  
  risks.forEach(risk => {
    riskContributions[risk.id] = new Array(iterations)
  })

  // Calculate baseline cost total
  const baselineCostTotal = Object.values(baselineCosts).reduce((sum, cost) => sum + cost, 0)

  // Run simulation iterations
  for (let i = 0; i < iterations; i++) {
    let totalCostImpact = 0
    let totalScheduleImpact = 0

    // Process each risk
    risks.forEach(risk => {
      // Sample from the risk's probability distribution
      const sample = sampleFromDistribution(
        risk.probabilityDistribution.distributionType,
        risk.probabilityDistribution.parameters
      )

      // Calculate impact
      const impact = sample * risk.baselineImpact
      riskContributions[risk.id][i] = impact

      // Add to appropriate outcome type
      if (risk.impactType === 'COST' || risk.impactType === 'BOTH') {
        totalCostImpact += impact
      }
      if (risk.impactType === 'SCHEDULE' || risk.impactType === 'BOTH') {
        totalScheduleImpact += impact
      }
    })

    // Store iteration results
    costOutcomes[i] = baselineCostTotal + totalCostImpact
    scheduleOutcomes[i] = totalScheduleImpact

    // Send progress updates every 1000 iterations
    if ((i + 1) % 1000 === 0) {
      self.postMessage({
        type: 'progress',
        progress: {
          current: i + 1,
          total: iterations,
          percentage: ((i + 1) / iterations) * 100
        }
      })
    }
  }

  // Calculate statistics
  const costStats = calculateStatistics(costOutcomes)
  const scheduleStats = calculateStatistics(scheduleOutcomes)

  return {
    costOutcomes,
    scheduleOutcomes,
    riskContributions,
    statistics: {
      cost: costStats,
      schedule: scheduleStats
    },
    iterations
  }
}

/**
 * Calculate statistical measures for an array of outcomes
 */
function calculateStatistics(outcomes) {
  const sorted = [...outcomes].sort((a, b) => a - b)
  const n = sorted.length

  // Mean
  const mean = sorted.reduce((sum, val) => sum + val, 0) / n

  // Median
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)]

  // Standard deviation
  const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n
  const stdDev = Math.sqrt(variance)

  // Min and Max
  const min = sorted[0]
  const max = sorted[n - 1]

  // Percentiles
  const p10 = sorted[Math.floor(n * 0.10)]
  const p25 = sorted[Math.floor(n * 0.25)]
  const p75 = sorted[Math.floor(n * 0.75)]
  const p90 = sorted[Math.floor(n * 0.90)]
  const p95 = sorted[Math.floor(n * 0.95)]

  return {
    mean,
    median,
    stdDev,
    variance,
    min,
    max,
    p10,
    p25,
    p75,
    p90,
    p95
  }
}

/**
 * Calculate specific percentiles for outcomes
 */
function calculatePercentiles(outcomes, percentiles) {
  const sorted = [...outcomes].sort((a, b) => a - b)
  const n = sorted.length
  const result = {}

  percentiles.forEach(p => {
    const index = Math.floor((p / 100) * n)
    result[`p${p}`] = sorted[Math.min(index, n - 1)]
  })

  return result
}

/**
 * Calculate risk contribution statistics
 */
function calculateRiskContributions(riskData) {
  const contributions = {}

  Object.keys(riskData).forEach(riskId => {
    const values = riskData[riskId]
    contributions[riskId] = calculateStatistics(values)
  })

  return contributions
}

/**
 * Sample from a probability distribution
 */
function sampleFromDistribution(distributionType, parameters) {
  switch (distributionType) {
    case 'NORMAL':
      return sampleNormal(parameters.mean || 0, parameters.stdDev || 1)
    
    case 'UNIFORM':
      return sampleUniform(parameters.min || 0, parameters.max || 1)
    
    case 'TRIANGULAR':
      return sampleTriangular(
        parameters.min || 0,
        parameters.mode || 0.5,
        parameters.max || 1
      )
    
    case 'LOGNORMAL':
      return sampleLogNormal(parameters.mean || 0, parameters.stdDev || 1)
    
    case 'EXPONENTIAL':
      return sampleExponential(parameters.lambda || 1)
    
    case 'BETA':
      return sampleBeta(parameters.alpha || 2, parameters.beta || 2)
    
    default:
      return sampleUniform(0, 1)
  }
}

/**
 * Generate samples from a distribution
 */
function generateDistribution(distributionType, parameters, samples) {
  const result = new Array(samples)
  
  for (let i = 0; i < samples; i++) {
    result[i] = sampleFromDistribution(distributionType, parameters)
  }
  
  return result
}

// ============================================================================
// Random Number Generation Functions
// ============================================================================

let randomSeed = Date.now()

function seedRandom(seed) {
  randomSeed = seed
}

function random() {
  // Simple LCG (Linear Congruential Generator)
  randomSeed = (randomSeed * 1664525 + 1013904223) % 4294967296
  return randomSeed / 4294967296
}

function randomNormal() {
  // Box-Muller transform
  const u1 = random()
  const u2 = random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

// ============================================================================
// Distribution Sampling Functions
// ============================================================================

function sampleNormal(mean, stdDev) {
  return mean + stdDev * randomNormal()
}

function sampleUniform(min, max) {
  return min + (max - min) * random()
}

function sampleTriangular(min, mode, max) {
  const u = random()
  const fc = (mode - min) / (max - min)
  
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min))
  } else {
    return max - Math.sqrt((1 - u) * (max - min) * (max - mode))
  }
}

function sampleLogNormal(mean, stdDev) {
  const normal = sampleNormal(mean, stdDev)
  return Math.exp(normal)
}

function sampleExponential(lambda) {
  return -Math.log(1 - random()) / lambda
}

function sampleBeta(alpha, beta) {
  // Using rejection sampling (simplified)
  const x = sampleGamma(alpha, 1)
  const y = sampleGamma(beta, 1)
  return x / (x + y)
}

function sampleGamma(shape, scale) {
  // Marsaglia and Tsang method (simplified)
  if (shape < 1) {
    return sampleGamma(shape + 1, scale) * Math.pow(random(), 1 / shape)
  }
  
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  
  while (true) {
    let x, v
    do {
      x = randomNormal()
      v = 1 + c * x
    } while (v <= 0)
    
    v = v * v * v
    const u = random()
    
    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v * scale
    }
    
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v * scale
    }
  }
}
