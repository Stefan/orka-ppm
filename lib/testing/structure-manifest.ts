/**
 * Structure Manifest Types and Schema
 * 
 * Defines expected elements for pages and components to enable
 * automated structure verification testing.
 */

/**
 * Defines a single UI element in the structure
 */
export interface ElementDefinition {
  /** Unique test ID for the element (data-testid value) */
  testId: string;
  
  /** Whether this element is required to be present */
  required: boolean;
  
  /** Human-readable description of the element's purpose */
  description: string;
  
  /** Optional child elements nested within this element */
  children?: ElementDefinition[];
  
  /** Optional accessibility requirements */
  accessibility?: {
    role?: string;
    ariaLabel?: string;
    ariaDescribedBy?: string;
    ariaLabelledBy?: string;
    tabIndex?: number;
  };
}

/**
 * Defines a logical section of a page or component
 */
export interface SectionDefinition {
  /** Section name for reporting */
  name: string;
  
  /** Test ID for the section container */
  testId: string;
  
  /** Whether this section is required */
  required: boolean;
  
  /** Elements within this section */
  elements: ElementDefinition[];
  
  /** Optional description of the section */
  description?: string;
}

/**
 * Defines conditional sections that appear based on state
 */
export interface ConditionalSection {
  /** Condition description (e.g., "user is authenticated") */
  condition: string;
  
  /** Sections that appear when condition is met */
  sections: SectionDefinition[];
}

/**
 * Complete structure definition for a page
 */
export interface PageStructure {
  /** URL path for the page */
  path: string;
  
  /** Human-readable page name */
  name: string;
  
  /** Required and optional sections on the page */
  sections: SectionDefinition[];
  
  /** Sections that appear conditionally */
  conditionalSections?: ConditionalSection[];
  
  /** Optional selector to wait for before verification */
  waitForSelector?: string;
  
  /** Optional selectors to mask in visual regression tests */
  maskSelectors?: string[];
}

/**
 * Component state definitions
 */
export interface ComponentStates {
  /** Elements shown in loading state */
  loading?: ElementDefinition[];
  
  /** Elements shown in error state */
  error?: ElementDefinition[];
  
  /** Elements shown in empty/no-data state */
  empty?: ElementDefinition[];
  
  /** Custom state definitions */
  [key: string]: ElementDefinition[] | undefined;
}

/**
 * Complete structure definition for a component
 */
export interface ComponentStructure {
  /** Component name */
  name: string;
  
  /** Root test ID for the component */
  testId: string;
  
  /** Elements that must always be present */
  requiredElements: ElementDefinition[];
  
  /** Elements that may or may not be present */
  optionalElements?: ElementDefinition[];
  
  /** State-specific element definitions */
  states: ComponentStates;
  
  /** Optional description */
  description?: string;
}

/**
 * Validation error for manifest schema
 */
export interface ManifestValidationError {
  /** Path to the invalid field */
  path: string;
  
  /** Error message */
  message: string;
  
  /** Severity level */
  severity: 'error' | 'warning';
}

/**
 * Result of manifest validation
 */
export interface ManifestValidationResult {
  /** Whether the manifest is valid */
  valid: boolean;
  
  /** List of validation errors */
  errors: ManifestValidationError[];
  
  /** List of validation warnings */
  warnings: ManifestValidationError[];
}

/**
 * Validates an ElementDefinition
 */
function validateElement(
  element: any,
  path: string
): ManifestValidationError[] {
  const errors: ManifestValidationError[] = [];
  
  if (!element || typeof element !== 'object') {
    errors.push({
      path,
      message: 'Element must be an object',
      severity: 'error',
    });
    return errors;
  }
  
  if (!element.testId || typeof element.testId !== 'string') {
    errors.push({
      path: `${path}.testId`,
      message: 'Element must have a testId string',
      severity: 'error',
    });
  }
  
  if (typeof element.required !== 'boolean') {
    errors.push({
      path: `${path}.required`,
      message: 'Element must have a required boolean',
      severity: 'error',
    });
  }
  
  if (!element.description || typeof element.description !== 'string') {
    errors.push({
      path: `${path}.description`,
      message: 'Element must have a description string',
      severity: 'error',
    });
  }
  
  if (element.children) {
    if (!Array.isArray(element.children)) {
      errors.push({
        path: `${path}.children`,
        message: 'Element children must be an array',
        severity: 'error',
      });
    } else {
      element.children.forEach((child: any, index: number) => {
        errors.push(...validateElement(child, `${path}.children[${index}]`));
      });
    }
  }
  
  return errors;
}

/**
 * Validates a SectionDefinition
 */
function validateSection(
  section: any,
  path: string
): ManifestValidationError[] {
  const errors: ManifestValidationError[] = [];
  
  if (!section || typeof section !== 'object') {
    errors.push({
      path,
      message: 'Section must be an object',
      severity: 'error',
    });
    return errors;
  }
  
  if (!section.name || typeof section.name !== 'string') {
    errors.push({
      path: `${path}.name`,
      message: 'Section must have a name string',
      severity: 'error',
    });
  }
  
  if (!section.testId || typeof section.testId !== 'string') {
    errors.push({
      path: `${path}.testId`,
      message: 'Section must have a testId string',
      severity: 'error',
    });
  }
  
  if (typeof section.required !== 'boolean') {
    errors.push({
      path: `${path}.required`,
      message: 'Section must have a required boolean',
      severity: 'error',
    });
  }
  
  if (!Array.isArray(section.elements)) {
    errors.push({
      path: `${path}.elements`,
      message: 'Section must have an elements array',
      severity: 'error',
    });
  } else {
    section.elements.forEach((element: any, index: number) => {
      errors.push(...validateElement(element, `${path}.elements[${index}]`));
    });
  }
  
  return errors;
}

/**
 * Validates a PageStructure manifest
 */
export function validatePageStructure(
  structure: any
): ManifestValidationResult {
  const errors: ManifestValidationError[] = [];
  const warnings: ManifestValidationError[] = [];
  
  if (!structure || typeof structure !== 'object') {
    return {
      valid: false,
      errors: [{
        path: 'root',
        message: 'Page structure must be an object',
        severity: 'error',
      }],
      warnings: [],
    };
  }
  
  // Validate required fields
  if (!structure.path || typeof structure.path !== 'string') {
    errors.push({
      path: 'path',
      message: 'Page structure must have a path string',
      severity: 'error',
    });
  }
  
  if (!structure.name || typeof structure.name !== 'string') {
    errors.push({
      path: 'name',
      message: 'Page structure must have a name string',
      severity: 'error',
    });
  }
  
  if (!Array.isArray(structure.sections)) {
    errors.push({
      path: 'sections',
      message: 'Page structure must have a sections array',
      severity: 'error',
    });
  } else {
    structure.sections.forEach((section: any, index: number) => {
      errors.push(...validateSection(section, `sections[${index}]`));
    });
  }
  
  // Validate optional fields
  if (structure.conditionalSections) {
    if (!Array.isArray(structure.conditionalSections)) {
      errors.push({
        path: 'conditionalSections',
        message: 'conditionalSections must be an array',
        severity: 'error',
      });
    } else {
      structure.conditionalSections.forEach((conditional: any, index: number) => {
        if (!conditional.condition || typeof conditional.condition !== 'string') {
          errors.push({
            path: `conditionalSections[${index}].condition`,
            message: 'Conditional section must have a condition string',
            severity: 'error',
          });
        }
        
        if (!Array.isArray(conditional.sections)) {
          errors.push({
            path: `conditionalSections[${index}].sections`,
            message: 'Conditional section must have a sections array',
            severity: 'error',
          });
        } else {
          conditional.sections.forEach((section: any, sIndex: number) => {
            errors.push(
              ...validateSection(
                section,
                `conditionalSections[${index}].sections[${sIndex}]`
              )
            );
          });
        }
      });
    }
  }
  
  // Warnings for optional but recommended fields
  if (!structure.waitForSelector) {
    warnings.push({
      path: 'waitForSelector',
      message: 'Consider adding waitForSelector for dynamic content',
      severity: 'warning',
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a ComponentStructure manifest
 */
export function validateComponentStructure(
  structure: any
): ManifestValidationResult {
  const errors: ManifestValidationError[] = [];
  const warnings: ManifestValidationError[] = [];
  
  if (!structure || typeof structure !== 'object') {
    return {
      valid: false,
      errors: [{
        path: 'root',
        message: 'Component structure must be an object',
        severity: 'error',
      }],
      warnings: [],
    };
  }
  
  // Validate required fields
  if (!structure.name || typeof structure.name !== 'string') {
    errors.push({
      path: 'name',
      message: 'Component structure must have a name string',
      severity: 'error',
    });
  }
  
  if (!structure.testId || typeof structure.testId !== 'string') {
    errors.push({
      path: 'testId',
      message: 'Component structure must have a testId string',
      severity: 'error',
    });
  }
  
  if (!Array.isArray(structure.requiredElements)) {
    errors.push({
      path: 'requiredElements',
      message: 'Component structure must have a requiredElements array',
      severity: 'error',
    });
  } else {
    structure.requiredElements.forEach((element: any, index: number) => {
      errors.push(...validateElement(element, `requiredElements[${index}]`));
    });
  }
  
  if (!structure.states || typeof structure.states !== 'object') {
    errors.push({
      path: 'states',
      message: 'Component structure must have a states object',
      severity: 'error',
    });
  } else {
    // Validate state definitions
    Object.entries(structure.states).forEach(([stateName, elements]) => {
      if (elements && !Array.isArray(elements)) {
        errors.push({
          path: `states.${stateName}`,
          message: `State "${stateName}" must be an array of elements`,
          severity: 'error',
        });
      } else if (Array.isArray(elements)) {
        elements.forEach((element: any, index: number) => {
          errors.push(
            ...validateElement(element, `states.${stateName}[${index}]`)
          );
        });
      }
    });
  }
  
  // Validate optional fields
  if (structure.optionalElements) {
    if (!Array.isArray(structure.optionalElements)) {
      errors.push({
        path: 'optionalElements',
        message: 'optionalElements must be an array',
        severity: 'error',
      });
    } else {
      structure.optionalElements.forEach((element: any, index: number) => {
        errors.push(...validateElement(element, `optionalElements[${index}]`));
      });
    }
  }
  
  // Warnings
  if (!structure.description) {
    warnings.push({
      path: 'description',
      message: 'Consider adding a description for documentation',
      severity: 'warning',
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Dashboard Page Structure
 */
const dashboardStructure: PageStructure = {
  path: '/dashboards',
  name: 'Dashboard',
  waitForSelector: '[data-testid="dashboard-header"]',
  sections: [
    {
      name: 'Header',
      testId: 'dashboard-header',
      required: true,
      description: 'Dashboard page header with title and controls',
      elements: [
        { testId: 'dashboard-title', required: true, description: 'Page title' },
        { testId: 'dashboard-project-count', required: true, description: 'Project count display' },
        { testId: 'dashboard-refresh-button', required: true, description: 'Refresh button' },
      ]
    },
    {
      name: 'KPI Cards',
      testId: 'dashboard-kpi-section',
      required: true,
      description: 'Key performance indicator cards',
      elements: [
        { testId: 'kpi-card-success-rate', required: true, description: 'Success rate KPI' },
        { testId: 'kpi-card-budget-performance', required: true, description: 'Budget performance KPI' },
        { testId: 'kpi-card-timeline-performance', required: true, description: 'Timeline performance KPI' },
        { testId: 'kpi-card-active-projects', required: true, description: 'Active projects KPI' },
        { testId: 'kpi-card-resources', required: true, description: 'Resources KPI' },
      ]
    },
    {
      name: 'Variance Section',
      testId: 'dashboard-variance-section',
      required: true,
      description: 'Budget variance analysis section',
      elements: [
        { testId: 'variance-kpis', required: false, description: 'Variance KPIs component (dynamically loaded)' },
        { testId: 'variance-trends', required: false, description: 'Variance trends chart (dynamically loaded)' },
      ]
    },
    {
      name: 'Project Health',
      testId: 'dashboard-health-section',
      required: true,
      description: 'Project health summary',
      elements: [
        { testId: 'health-summary', required: true, description: 'Health summary card' },
        { testId: 'health-healthy-count', required: true, description: 'Healthy projects count' },
        { testId: 'health-at-risk-count', required: true, description: 'At-risk projects count' },
        { testId: 'health-critical-count', required: true, description: 'Critical projects count' },
      ]
    },
    {
      name: 'Recent Projects',
      testId: 'dashboard-projects-section',
      required: true,
      description: 'Recent projects grid',
      elements: [
        { testId: 'recent-projects-grid', required: true, description: 'Projects grid container' },
      ]
    },
    {
      name: 'Quick Actions',
      testId: 'dashboard-quick-actions',
      required: true,
      description: 'Quick action buttons',
      elements: [
        { testId: 'action-scenarios', required: true, description: 'Scenarios button' },
        { testId: 'action-resources', required: true, description: 'Resources button' },
        { testId: 'action-financials', required: true, description: 'Financials button' },
        { testId: 'action-reports', required: true, description: 'Reports button' },
        { testId: 'action-import', required: true, description: 'Import button' },
      ]
    }
  ]
};

/**
 * Financials Page Structure
 */
const financialsStructure: PageStructure = {
  path: '/financials',
  name: 'Financials',
  waitForSelector: '[data-testid="financials-header"]',
  sections: [
    {
      name: 'Header',
      testId: 'financials-header',
      required: true,
      description: 'Financials page header with controls',
      elements: []
    },
    {
      name: 'Action Buttons',
      testId: 'financials-actions',
      required: true,
      description: 'Financial action buttons',
      elements: []
    },
    {
      name: 'Tab Navigation',
      testId: 'financials-tabs',
      required: true,
      description: 'View mode navigation tabs',
      elements: []
    },
    {
      name: 'Financial Metrics',
      testId: 'financials-metrics',
      required: true,
      description: 'Financial metrics dashboard',
      elements: []
    },
    {
      name: 'Budget Variance Table',
      testId: 'financials-variance-table',
      required: true,
      description: 'Budget variance data table',
      elements: []
    }
  ],
  conditionalSections: [
    {
      condition: 'Critical alerts exist',
      sections: [
        {
          name: 'Critical Alerts',
          testId: 'financials-alerts',
          required: false,
          description: 'Critical financial alerts',
          elements: []
        }
      ]
    },
    {
      condition: 'Filters are shown',
      sections: [
        {
          name: 'Filter Panel',
          testId: 'financials-filters',
          required: false,
          description: 'Financial data filters',
          elements: []
        }
      ]
    },
    {
      condition: 'Overview view is active',
      sections: [
        {
          name: 'Overview View',
          testId: 'financials-overview-view',
          required: false,
          description: 'Financial overview content',
          elements: []
        }
      ]
    },
    {
      condition: 'Analysis view is active',
      sections: [
        {
          name: 'Analysis View',
          testId: 'financials-analysis-view',
          required: false,
          description: 'Financial analysis content',
          elements: []
        }
      ]
    },
    {
      condition: 'Trends view is active',
      sections: [
        {
          name: 'Trends View',
          testId: 'financials-trends-view',
          required: false,
          description: 'Financial trends content',
          elements: []
        }
      ]
    },
    {
      condition: 'Detailed view is active',
      sections: [
        {
          name: 'Detailed View',
          testId: 'financials-detailed-view',
          required: false,
          description: 'Detailed financial data',
          elements: []
        }
      ]
    },
    {
      condition: 'PO breakdown view is active',
      sections: [
        {
          name: 'PO Breakdown View',
          testId: 'financials-po-breakdown-view',
          required: false,
          description: 'Purchase order breakdown',
          elements: []
        }
      ]
    },
    {
      condition: 'Commitments actuals view is active',
      sections: [
        {
          name: 'Commitments Actuals View',
          testId: 'financials-commitments-actuals-view',
          required: false,
          description: 'Commitments vs actuals comparison',
          elements: []
        }
      ]
    }
  ]
};

/**
 * Projects Page Structure
 */
const projectsStructure: PageStructure = {
  path: '/projects',
  name: 'Projects',
  sections: [
    {
      name: 'Header',
      testId: 'projects-header',
      required: true,
      description: 'Projects page header',
      elements: [
        { testId: 'projects-title', required: true, description: 'Page title' },
        { testId: 'projects-create-button', required: false, description: 'Create project button' },
      ]
    },
    {
      name: 'Projects List',
      testId: 'projects-list',
      required: true,
      description: 'List of all projects',
      elements: []
    }
  ]
};

/**
 * Resources Page Structure
 */
const resourcesStructure: PageStructure = {
  path: '/resources',
  name: 'Resources',
  sections: [
    {
      name: 'Header',
      testId: 'resources-header',
      required: true,
      description: 'Resources page header',
      elements: [
        { testId: 'resources-title', required: true, description: 'Page title' },
      ]
    },
    {
      name: 'Resources Grid',
      testId: 'resources-grid',
      required: true,
      description: 'Resource allocation grid',
      elements: []
    }
  ]
};

/**
 * Reports Page Structure
 */
const reportsStructure: PageStructure = {
  path: '/reports',
  name: 'Reports',
  sections: [
    {
      name: 'Header',
      testId: 'reports-header',
      required: true,
      description: 'Reports page header',
      elements: [
        { testId: 'reports-title', required: true, description: 'Page title' },
      ]
    },
    {
      name: 'Reports List',
      testId: 'reports-list',
      required: true,
      description: 'Available reports list',
      elements: []
    }
  ]
};

/**
 * Risks Page Structure
 */
const risksStructure: PageStructure = {
  path: '/risks',
  name: 'Risks',
  sections: [
    {
      name: 'Header',
      testId: 'risks-header',
      required: true,
      description: 'Risks page header',
      elements: [
        { testId: 'risks-title', required: true, description: 'Page title' },
      ]
    },
    {
      name: 'Risks Dashboard',
      testId: 'risks-dashboard',
      required: true,
      description: 'Risk management dashboard',
      elements: []
    }
  ]
};

/**
 * Scenarios Page Structure
 */
const scenariosStructure: PageStructure = {
  path: '/scenarios',
  name: 'Scenarios',
  sections: [
    {
      name: 'Header',
      testId: 'scenarios-header',
      required: true,
      description: 'Scenarios page header',
      elements: [
        { testId: 'scenarios-title', required: true, description: 'Page title' },
      ]
    },
    {
      name: 'Scenarios List',
      testId: 'scenarios-list',
      required: true,
      description: 'List of scenarios',
      elements: []
    }
  ]
};

/**
 * Monte Carlo Page Structure
 */
const monteCarloStructure: PageStructure = {
  path: '/monte-carlo',
  name: 'Monte Carlo Simulation',
  sections: [
    {
      name: 'Header',
      testId: 'monte-carlo-header',
      required: true,
      description: 'Monte Carlo page header',
      elements: [
        { testId: 'monte-carlo-title', required: true, description: 'Page title' },
      ]
    },
    {
      name: 'Simulation Controls',
      testId: 'monte-carlo-controls',
      required: true,
      description: 'Simulation configuration controls',
      elements: []
    },
    {
      name: 'Results',
      testId: 'monte-carlo-results',
      required: false,
      description: 'Simulation results display',
      elements: []
    }
  ]
};

/**
 * Admin Page Structure
 */
const adminStructure: PageStructure = {
  path: '/admin',
  name: 'Admin',
  sections: [
    {
      name: 'Header',
      testId: 'admin-header',
      required: true,
      description: 'Admin page header',
      elements: [
        { testId: 'admin-title', required: true, description: 'Page title' },
      ]
    },
    {
      name: 'Admin Dashboard',
      testId: 'admin-dashboard',
      required: true,
      description: 'Admin control panel',
      elements: []
    }
  ]
};

/**
 * Audit Page Structure
 */
const auditStructure: PageStructure = {
  path: '/audit',
  name: 'Audit',
  sections: [
    {
      name: 'Header',
      testId: 'audit-header',
      required: true,
      description: 'Audit page header',
      elements: [
        { testId: 'audit-title', required: true, description: 'Page title' },
      ]
    },
    {
      name: 'Audit Trail',
      testId: 'audit-trail',
      required: true,
      description: 'Audit trail table',
      elements: []
    }
  ]
};

/**
 * Changes Page Structure
 */
const changesStructure: PageStructure = {
  path: '/changes',
  name: 'Changes',
  sections: [
    {
      name: 'Header',
      testId: 'changes-header',
      required: true,
      description: 'Changes page header',
      elements: [
        { testId: 'changes-title', required: true, description: 'Page title' },
      ]
    },
    {
      name: 'Changes List',
      testId: 'changes-list',
      required: true,
      description: 'Change orders list',
      elements: []
    }
  ]
};

/**
 * Feedback Page Structure
 */
const feedbackStructure: PageStructure = {
  path: '/feedback',
  name: 'Feedback',
  sections: [
    {
      name: 'Header',
      testId: 'feedback-header',
      required: true,
      description: 'Feedback page header',
      elements: [
        { testId: 'feedback-title', required: true, description: 'Page title' },
      ]
    },
    {
      name: 'Feedback Form',
      testId: 'feedback-form',
      required: true,
      description: 'User feedback form',
      elements: []
    }
  ]
};

/**
 * Import Page Structure
 */
const importStructure: PageStructure = {
  path: '/import',
  name: 'Import',
  sections: [
    {
      name: 'Header',
      testId: 'import-header',
      required: true,
      description: 'Import page header',
      elements: [
        { testId: 'import-title', required: true, description: 'Page title' },
      ]
    },
    {
      name: 'Import Interface',
      testId: 'import-interface',
      required: true,
      description: 'Data import interface',
      elements: []
    }
  ]
};

/**
 * Registry of all page structures
 */
export const PAGE_STRUCTURES: Record<string, PageStructure> = {
  dashboard: dashboardStructure,
  financials: financialsStructure,
  projects: projectsStructure,
  resources: resourcesStructure,
  reports: reportsStructure,
  risks: risksStructure,
  scenarios: scenariosStructure,
  'monte-carlo': monteCarloStructure,
  admin: adminStructure,
  audit: auditStructure,
  changes: changesStructure,
  feedback: feedbackStructure,
  import: importStructure,
};

/**
 * VarianceKPIs Component Structure
 */
const varianceKpisStructure: ComponentStructure = {
  name: 'VarianceKPIs',
  testId: 'variance-kpis',
  description: 'Budget variance KPIs component showing financial metrics',
  requiredElements: [
    { testId: 'variance-kpis-header', required: true, description: 'Component header with title' },
    { testId: 'variance-kpis-grid', required: true, description: 'KPI grid container (2x2 layout)' },
    { testId: 'variance-kpis-net-variance', required: true, description: 'Net variance card' },
    { testId: 'variance-kpis-variance-percent', required: true, description: 'Variance percentage card' },
    { testId: 'variance-kpis-over-budget', required: true, description: 'Over budget count card' },
    { testId: 'variance-kpis-under-budget', required: true, description: 'Under budget count card' },
    { testId: 'variance-kpis-commitments-actuals', required: true, description: 'Commitments vs Actuals section' },
  ],
  states: {
    loading: [
      { testId: 'variance-kpis-skeleton', required: true, description: 'Loading skeleton state' },
    ],
    error: [
      { testId: 'variance-kpis-error', required: true, description: 'Error state message' },
    ],
    empty: [
      { testId: 'variance-kpis-error', required: true, description: 'Empty state message (uses error testId)' },
    ]
  }
};

/**
 * Dashboard KPI Card Component Structure
 */
const dashboardKpiCardStructure: ComponentStructure = {
  name: 'KPICard',
  testId: 'kpi-card',
  description: 'Dashboard KPI card showing key performance metrics',
  requiredElements: [
    { testId: 'kpi-card-label', required: true, description: 'KPI label text' },
    { testId: 'kpi-card-value', required: true, description: 'KPI value display' },
    { testId: 'kpi-card-change', required: true, description: 'Change indicator' },
    { testId: 'kpi-card-icon', required: true, description: 'KPI icon' },
  ],
  states: {}
};

/**
 * TopBar Navigation Component Structure
 */
const topBarStructure: ComponentStructure = {
  name: 'TopBar',
  testId: 'top-bar',
  description: 'Top navigation bar with menu, logo, and user actions',
  requiredElements: [
    { testId: 'top-bar-logo', required: true, description: 'Logo and brand section' },
    { testId: 'top-bar-menu-toggle', required: true, description: 'Mobile menu toggle button' },
    { testId: 'top-bar-nav', required: true, description: 'Main navigation links' },
    { testId: 'top-bar-actions', required: true, description: 'Action buttons (language, notifications, user)' },
    { testId: 'top-bar-notifications', required: true, description: 'Notifications button' },
    { testId: 'top-bar-user-menu', required: true, description: 'User menu button' },
  ],
  states: {}
};

/**
 * MobileNav Component Structure
 */
const mobileNavStructure: ComponentStructure = {
  name: 'MobileNav',
  testId: 'mobile-nav',
  description: 'Mobile navigation drawer with menu items',
  requiredElements: [
    { testId: 'mobile-nav-header', required: true, description: 'Mobile nav header with logo and close button' },
    { testId: 'mobile-nav-close', required: true, description: 'Close button' },
    { testId: 'mobile-nav-links', required: true, description: 'Navigation links container' },
  ],
  states: {}
};

/**
 * Registry of all component structures
 * To be populated as components are added
 */
export const COMPONENT_STRUCTURES: Record<string, ComponentStructure> = {
  'variance-kpis': varianceKpisStructure,
  'kpi-card': dashboardKpiCardStructure,
  'top-bar': topBarStructure,
  'mobile-nav': mobileNavStructure,
};
