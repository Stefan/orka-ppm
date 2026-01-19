# i18n Developer Guide

## Quick Start

### Using Translations in Components

```typescript
import { useTranslations } from '../../../lib/i18n/context'

export default function MyComponent() {
  const { t } = useTranslations()
  
  return (
    <div>
      <h1>{t('page.title')}</h1>
      <button>{t('common.save')}</button>
    </div>
  )
}
```

## Available Languages

| Code | Language | Status |
|------|----------|--------|
| `en` | English | ✅ Complete |
| `de` | German | ✅ Complete |
| `fr` | French | ✅ Complete |
| `es` | Spanish | ✅ Complete |
| `pl` | Polish | ✅ Complete |
| `gsw` | Swiss German (Basel) | ✅ Complete |

## Translation Key Structure

### Navigation
```typescript
t('nav.dashboards')    // "Dashboards"
t('nav.scenarios')     // "Scenarios"
t('nav.resources')     // "Resources"
t('nav.reports')       // "Reports"
t('nav.financials')    // "Financials"
t('nav.risks')         // "Risks"
```

### Common UI Elements
```typescript
t('common.loading')      // "Loading..."
t('common.error')        // "Error"
t('common.save')         // "Save"
t('common.cancel')       // "Cancel"
t('common.delete')       // "Delete"
t('common.edit')         // "Edit"
t('common.add')          // "Add"
t('common.search')       // "Search"
t('common.filter')       // "Filter"
t('common.export')       // "Export"
t('common.import')       // "Import"
t('common.refresh')      // "Refresh"
t('common.filters')      // "Filters"
t('common.clearFilters') // "Clear Filters"
```

### Dashboard
```typescript
t('dashboard.title')           // "Portfolio Dashboard"
t('dashboard.projects')        // "projects"
t('dashboard.updated')         // "Updated"
t('dashboard.synced')          // "Synced"
t('dashboard.syncing')         // "Syncing..."
t('dashboard.live')            // "Live"
t('dashboard.critical')        // "Critical"
t('dashboard.budgetAlert')     // "Budget Alert"
t('dashboard.budgetAlerts')    // "Budget Alerts"
```

### Financials
```typescript
t('financials.title')              // "Financial Management"
t('financials.criticalAlert')      // "Critical Alert"
t('financials.criticalAlerts')     // "Critical Alerts"
t('financials.totalBudget')        // "Total Budget"
t('financials.variance')           // "Variance"
t('financials.projectsTracked')    // "projects tracked"
t('financials.totalSpent')         // "Total Spent"
t('financials.avgUtilization')     // "Avg. Utilization"
t('financials.overBudget')         // "Over Budget"
t('financials.underBudget')        // "Under Budget"

// Tabs
t('financials.tabs.overview')            // "Overview"
t('financials.tabs.detailed')            // "Detailed"
t('financials.tabs.trends')              // "Trends"
t('financials.tabs.analysis')            // "Analysis"
t('financials.tabs.poBreakdown')         // "PO Breakdown"
t('financials.tabs.csvImport')           // "CSV Import"
t('financials.tabs.commitmentsActuals')  // "Commitments vs Actuals"

// Descriptions
t('financials.descriptions.overview')            // "Overall view and KPIs"
t('financials.descriptions.detailed')            // "Detailed category analysis"
t('financials.descriptions.trends')              // "Temporal development and forecasts"
t('financials.descriptions.analysis')            // "Advanced cost analysis"
t('financials.descriptions.poBreakdown')         // "SAP Purchase Order Hierarchy"
t('financials.descriptions.csvImport')           // "Import data"
t('financials.descriptions.commitmentsActuals')  // "Planned vs. Actual comparison"
```

### Resources
```typescript
t('resources.title')                  // "Resource Management"
t('resources.overallocated')          // "Overallocated"
t('resources.live')                   // "Live"
t('resources.of')                     // "of"
t('resources.avg')                    // "Avg"
t('resources.available')              // "Available"
t('resources.totalResources')         // "Total Resources"
t('resources.avgUtilization')         // "Avg. Utilization"
t('resources.search')                 // "Search"
t('resources.nameOrEmail')            // "Name or email..."
t('resources.role')                   // "Role"
t('resources.allRoles')               // "All Roles"
t('resources.errorLoading')           // "Error loading resources"
```

### Reports
```typescript
t('reports.title')              // "AI-Powered Reports"
t('reports.subtitle')           // "Ask questions about your portfolio..."
t('reports.generateReport')     // "Generate Report"
t('reports.typeMessage')        // "Type your message..."
t('reports.send')               // "Send"
```

### Scenarios
```typescript
t('scenarios.title')            // "Scenarios"
t('scenarios.subtitle')         // "What-if analysis and scenario comparison"
t('scenarios.createScenario')   // "Create Scenario"
t('scenarios.compareScenarios') // "Compare Scenarios"
```

### Monte Carlo
```typescript
t('monteCarlo.title')                  // "Monte Carlo Risk Analysis"
t('monteCarlo.subtitle')               // "Statistical simulation..."
t('monteCarlo.configure')              // "Configure"
t('monteCarlo.runSimulation')          // "Run Simulation"
t('monteCarlo.simulationConfiguration') // "Simulation Configuration"
```

### Risks
```typescript
t('risks.title')           // "Risk Management"
t('risks.total')           // "Total"
t('risks.highRisk')        // "High Risk"
t('risks.matrix')          // "Matrix"
t('risks.trends')          // "Trends"
t('risks.detailed')        // "Detailed"
t('risks.overview')        // "Overview"
```

## Best Practices

### 1. Always Use Translation Keys
❌ **Bad**:
```typescript
<h1>Financial Management</h1>
```

✅ **Good**:
```typescript
<h1>{t('financials.title')}</h1>
```

### 2. Handle Pluralization
```typescript
// Use conditional logic for singular/plural
{count === 1 ? t('financials.criticalAlert') : t('financials.criticalAlerts')}
```

### 3. Keep Keys Organized
- Use dot notation for nested keys
- Group related translations together
- Use descriptive key names

### 4. Add New Keys to ALL Language Files
When adding a new translation key:
1. Add to `en.json` (base language)
2. Add to `de.json`
3. Add to `fr.json`
4. Add to `es.json`
5. Add to `pl.json`
6. Add to `gsw.json`

### 5. Test in Multiple Languages
Always test your component in at least 2-3 languages to ensure:
- Text fits in UI elements
- Layout doesn't break
- Translations make sense in context

## Adding New Translations

### Step 1: Add to English (en.json)
```json
{
  "myFeature": {
    "title": "My Feature",
    "description": "This is my feature",
    "action": "Do Something"
  }
}
```

### Step 2: Add to Other Languages
Translate the same structure to:
- `de.json` (German)
- `fr.json` (French)
- `es.json` (Spanish)
- `pl.json` (Polish)
- `gsw.json` (Swiss German)

### Step 3: Use in Component
```typescript
import { useTranslations } from '../../../lib/i18n/context'

export default function MyFeature() {
  const { t } = useTranslations()
  
  return (
    <div>
      <h1>{t('myFeature.title')}</h1>
      <p>{t('myFeature.description')}</p>
      <button>{t('myFeature.action')}</button>
    </div>
  )
}
```

## Common Patterns

### Conditional Text
```typescript
{isActive ? t('common.active') : t('common.inactive')}
```

### Dynamic Values
```typescript
{`${count} ${t('dashboard.projects')}`}
```

### Tooltips and Titles
```typescript
<button title={t('common.refresh')}>
  <RefreshIcon />
</button>
```

### Form Labels
```typescript
<label>{t('resources.nameOrEmail')}</label>
<input placeholder={t('resources.nameOrEmail')} />
```

## Troubleshooting

### Translation Not Showing
1. Check if key exists in all language files
2. Verify `useTranslations()` hook is called
3. Check for typos in translation key
4. Ensure language file is valid JSON

### Build Errors
```bash
# Validate JSON files
node -e "require('./public/locales/en.json')"
node -e "require('./public/locales/de.json')"
node -e "require('./public/locales/fr.json')"
node -e "require('./public/locales/es.json')"
node -e "require('./public/locales/pl.json')"
node -e "require('./public/locales/gsw.json')"
```

### Missing Translations
If a key is missing, the system will:
1. Fall back to English
2. Log a warning in development
3. Display the key name as fallback

## File Locations

```
public/locales/
├── en.json     # English (base)
├── de.json     # German
├── fr.json     # French
├── es.json     # Spanish
├── pl.json     # Polish
└── gsw.json    # Swiss German (Basel)
```

## Language Context

The i18n system uses React Context:
- Provider: `TranslationsProvider` in `lib/i18n/context.tsx`
- Hook: `useTranslations()` returns `{ t, language, setLanguage }`
- Storage: Language preference saved to localStorage

## Examples from Codebase

### FinancialHeader.tsx
```typescript
import { useTranslations } from '../../../lib/i18n/context'

export default function FinancialHeader() {
  const { t } = useTranslations()
  
  return (
    <div>
      <h1>{t('financials.title')}</h1>
      <button>{t('common.export')}</button>
      <button>{t('common.refresh')}</button>
      <button>{t('common.filters')}</button>
    </div>
  )
}
```

### FinancialMetrics.tsx
```typescript
import { useTranslations } from '../../../lib/i18n/context'

export default function FinancialMetrics() {
  const { t } = useTranslations()
  
  return (
    <div>
      <div>
        <p>{t('financials.totalBudget')}</p>
        <p>{metrics.total_budget}</p>
      </div>
      <div>
        <p>{t('financials.totalSpent')}</p>
        <p>{metrics.total_spent}</p>
      </div>
    </div>
  )
}
```

## Support

For questions or issues:
1. Check this guide
2. Review existing implementations in `app/financials/components/`
3. Verify translation files in `public/locales/`
4. Test with `npm run build`

---

**Last Updated**: Phase 2 Completion
**Status**: Production Ready ✅
