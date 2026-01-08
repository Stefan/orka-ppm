export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return amount.toLocaleString('de-DE', {
    style: 'currency',
    currency: currency
  })
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatFileSize(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function getHealthColor(health: string): string {
  switch (health) {
    case 'green': return 'bg-green-100 text-green-800'
    case 'yellow': return 'bg-yellow-100 text-yellow-800'
    case 'red': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'over_budget': return 'bg-red-100 text-red-800'
    case 'under_budget': return 'bg-green-100 text-green-800'
    case 'on_budget': return 'bg-blue-100 text-blue-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export function getVarianceColor(variance: number): string {
  return variance >= 0 ? 'text-red-600' : 'text-green-600'
}

export function getEfficiencyColor(efficiency: number): string {
  if (efficiency >= 80) return 'text-green-600'
  if (efficiency >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

export function getEfficiencyBarColor(efficiency: number): string {
  if (efficiency >= 80) return 'bg-green-500'
  if (efficiency >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}