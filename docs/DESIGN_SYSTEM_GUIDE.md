# ORKA PPM Design System Guide

## 🎨 Übersicht

Das Design-System ist **Mobile First** aber **Desktop Optimiert**. Alle Komponenten skalieren automatisch von Mobile zu Desktop.

## 📦 Verwendung

### Page Container

Verwende `PageContainer` für alle Seiten:

```tsx
import PageContainer from '@/components/shared/PageContainer'

export default function MyPage() {
  return (
    <PageContainer maxWidth="default">
      <h1>Meine Seite</h1>
      {/* Content */}
    </PageContainer>
  )
}
```

**MaxWidth Optionen:**
- `narrow` (1200px) - Für Formulare, Text-Seiten
- `default` (1400px) - Standard für die meisten Seiten
- `wide` (1600px) - Für Dashboards mit vielen Daten
- `full` - Keine Begrenzung (100% Breite)

### Grid Layouts

```tsx
{/* Responsive Grid - 1 col mobile, 2 tablet, 3 desktop, 4 xl */}
<div className="grid-responsive">
  <Card />
  <Card />
  <Card />
</div>

{/* Card Grid - 1 col mobile, 2 tablet, 3 desktop */}
<div className="grid-cards">
  <Card />
  <Card />
</div>

{/* Dashboard Grid - 1 col mobile, 2 desktop, 4 xl */}
<div className="grid-dashboard">
  <StatCard />
  <StatCard />
</div>
```

### Typography

```tsx
{/* Responsive Headings */}
<h1>Automatisch responsive (2xl → 3xl → 4xl)</h1>
<h2>Automatisch responsive (xl → 2xl → 3xl)</h2>

{/* Custom Responsive Text */}
<p className="text-responsive-base">Base → lg auf Desktop</p>
<h1 className="text-responsive-xl">2xl → 3xl → 4xl</h1>
```

### Spacing

```tsx
{/* Responsive Spacing */}
<div className="space-y-responsive">
  {/* 4 spacing mobile, 6 desktop */}
</div>

<div className="gap-responsive">
  {/* 4 gap mobile, 6 desktop */}
</div>

<div className="p-responsive">
  {/* p-4 mobile, p-6 tablet, p-8 desktop */}
</div>
```

### Cards

```tsx
<div className="card">
  <div className="card-header">
    <h3 className="card-title">Titel</h3>
  </div>
  <div className="card-body">
    Content
  </div>
</div>
```

### Navigation

```tsx
{/* Top Bar Links */}
<Link href="/page" className="nav-link">
  Link
</Link>

{/* Active State */}
<Link href="/page" className="nav-link nav-link-active">
  Active Link
</Link>

{/* Dropdown Items */}
<button className="dropdown-item">
  Item
</button>

{/* Active Dropdown */}
<button className="dropdown-item dropdown-item-active">
  Active Item
</button>
```

### Buttons

```tsx
{/* Primary Button */}
<button className="btn-primary">
  Speichern
</button>

{/* Secondary Button */}
<button className="btn-secondary">
  Abbrechen
</button>

{/* Icon Button */}
<button className="btn-icon">
  <Icon />
</button>
```

### Forms

```tsx
{/* Input Fields - Automatisch styled */}
<input 
  type="text" 
  placeholder="Automatisch gut lesbar"
  className="form-input"
/>

<textarea 
  placeholder="Automatisch gut lesbar"
  className="form-input"
/>
```

### Tables

```tsx
<div className="table-responsive">
  <table>
    <thead>
      <tr>
        <th>Header</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Data</td>
      </tr>
    </tbody>
  </table>
</div>
```

## 🎨 Farben

### Text Colors

```tsx
<p className="text-primary">Haupttext (#111827)</p>
<p className="text-secondary">Sekundär (#374151)</p>
<p className="text-tertiary">Tertiär (#6b7280)</p>
<p className="text-brand">Brand Blau (#2563eb)</p>
```

### CSS Variables

```css
var(--color-text-primary)    /* #111827 - Haupttext */
var(--color-text-secondary)  /* #374151 - Sekundär */
var(--color-text-tertiary)   /* #6b7280 - Icons */
var(--color-text-placeholder)/* #9ca3af - Platzhalter */

var(--color-brand-600)       /* #2563eb - Primary Blue */
var(--color-brand-700)       /* #1d4ed8 - Darker Blue */
```

## 📱 Breakpoints

```css
/* Mobile First */
sm:  640px   /* Tablet */
md:  768px   /* Tablet Landscape */
lg:  1024px  /* Desktop */
xl:  1280px  /* Large Desktop */
2xl: 1536px  /* Extra Large */
```

## ✅ Best Practices

### DO ✅

```tsx
// Verwende PageContainer für Seiten
<PageContainer maxWidth="default">
  <h1>Titel</h1>
  <div className="grid-cards">
    <Card />
  </div>
</PageContainer>

// Verwende responsive Klassen
<div className="space-y-responsive gap-responsive">
  
// Verwende Design-System Komponenten
<button className="btn-primary">
```

### DON'T ❌

```tsx
// Keine fixen Breiten
<div style={{ width: '1200px' }}>

// Keine inline Styles für Farben
<p style={{ color: '#666' }}>

// Keine custom Padding ohne Responsive
<div className="p-8">
```

## 🚀 Migration Bestehender Seiten

1. **Wrap mit PageContainer:**
```tsx
// Vorher
export default function Page() {
  return <div className="p-8">{content}</div>
}

// Nachher
export default function Page() {
  return (
    <PageContainer maxWidth="default">
      {content}
    </PageContainer>
  )
}
```

2. **Ersetze Grid Layouts:**
```tsx
// Vorher
<div className="grid grid-cols-4 gap-4">

// Nachher
<div className="grid-dashboard">
```

3. **Verwende responsive Spacing:**
```tsx
// Vorher
<div className="space-y-6">

// Nachher
<div className="space-y-responsive">
```

## 🎯 Beispiel: Dashboard Page

```tsx
import PageContainer from '@/components/shared/PageContainer'

export default function Dashboard() {
  return (
    <PageContainer maxWidth="wide">
      {/* Header */}
      <div className="mb-6">
        <h1>Portfolio Dashboard</h1>
        <p className="text-secondary">Übersicht aller Projekte</p>
      </div>

      {/* KPI Cards */}
      <div className="grid-dashboard mb-6">
        <div className="card">
          <div className="card-body">
            <h3 className="card-title">Total Projects</h3>
            <p className="text-3xl font-bold text-brand">42</p>
          </div>
        </div>
        {/* More cards */}
      </div>

      {/* Content Grid */}
      <div className="grid-cards">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Projects</h3>
          </div>
          <div className="card-body">
            {/* Content */}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
```

## 📚 Weitere Ressourcen

- Alle Klassen sind in `app/design-system.css` definiert
- Farben und Tokens in CSS Variables (`:root`)
- Responsive Breakpoints folgen Tailwind Standard
