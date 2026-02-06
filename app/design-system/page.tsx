'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/design-system'
import { 
  Check, X, AlertTriangle, Info, Search, Plus, Trash2, Edit, 
  Download, Upload, RefreshCw, Settings, User, Bell, Menu,
  ChevronRight, ChevronDown, Eye, EyeOff, Copy, ExternalLink,
  Filter, FileText, Play, Grid, Bookmark, Command
} from 'lucide-react'

type ComponentId = 
  | 'button-primary' | 'button-secondary' | 'button-outline' | 'button-ghost' | 'button-danger'
  | 'button-sizes' | 'button-icons' | 'button-states'
  | 'card-basic' | 'card-header' | 'card-footer' | 'card-interactive' | 'card-status'
  | 'input-default' | 'input-label' | 'input-error' | 'input-sizes' | 'input-special'
  | 'colors' | 'typography' | 'icons' | 'spacing'

interface NavItem {
  id: string
  label: string
  icon?: React.ReactNode
  children?: { id: ComponentId; label: string }[]
  isExpanded?: boolean
}

export default function DesignSystemPage() {
  const [activeComponent, setActiveComponent] = useState<ComponentId>('button-primary')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    buttons: true,
    cards: true,
    inputs: true,
    foundations: true,
  })

  const navItems: NavItem[] = [
    {
      id: 'buttons',
      label: 'Button',
      icon: <Grid className="w-4 h-4" />,
      children: [
        { id: 'button-primary', label: 'Primary' },
        { id: 'button-secondary', label: 'Secondary' },
        { id: 'button-outline', label: 'Outline' },
        { id: 'button-ghost', label: 'Ghost' },
        { id: 'button-danger', label: 'Danger' },
        { id: 'button-sizes', label: 'Sizes' },
        { id: 'button-icons', label: 'With Icons' },
        { id: 'button-states', label: 'States' },
      ],
    },
    {
      id: 'cards',
      label: 'Card',
      icon: <Grid className="w-4 h-4" />,
      children: [
        { id: 'card-basic', label: 'Basic' },
        { id: 'card-header', label: 'With Header' },
        { id: 'card-footer', label: 'With Footer' },
        { id: 'card-interactive', label: 'Interactive' },
        { id: 'card-status', label: 'Status Cards' },
      ],
    },
    {
      id: 'inputs',
      label: 'Input',
      icon: <Grid className="w-4 h-4" />,
      children: [
        { id: 'input-default', label: 'Default' },
        { id: 'input-label', label: 'With Label' },
        { id: 'input-error', label: 'Error State' },
        { id: 'input-sizes', label: 'Sizes' },
        { id: 'input-special', label: 'Special Inputs' },
      ],
    },
    {
      id: 'foundations',
      label: 'Foundations',
      icon: <FileText className="w-4 h-4" />,
      children: [
        { id: 'colors', label: 'Colors' },
        { id: 'typography', label: 'Typography' },
        { id: 'icons', label: 'Icons' },
        { id: 'spacing', label: 'Spacing' },
      ],
    },
  ]

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  const filteredNavItems = navItems.map(section => ({
    ...section,
    children: section.children?.filter(child => 
      child.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.children && section.children.length > 0)

  return (
    <div className="h-screen flex bg-white dark:bg-slate-800">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 dark:border-slate-700 flex flex-col bg-gray-50 dark:bg-slate-800/50">
        {/* Search Header */}
        <div className="p-3 border-b border-gray-200 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Find components"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-16 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded text-gray-600 dark:text-slate-300">⌘</kbd>
              <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded text-gray-600 dark:text-slate-300">K</kbd>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-500 dark:text-slate-400">
              <Filter className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-500 dark:text-slate-400">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2">
          <div className="px-3 py-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Components</span>
          </div>
          
          {filteredNavItems.map((section) => (
            <div key={section.id} className="mb-1">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700"
              >
                {expandedSections[section.id] ? (
                  <ChevronDown className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                )}
                <span className="text-orange-500">{section.icon}</span>
                <span className="font-medium">{section.label}</span>
              </button>
              
              {expandedSections[section.id] && section.children && (
                <div className="ml-4">
                  {section.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setActiveComponent(child.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors',
                        activeComponent === child.id
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700'
                      )}
                    >
                      <Bookmark className={cn(
                        'w-3 h-3',
                        activeComponent === child.id ? 'text-white' : 'text-gray-400 dark:text-slate-500'
                      )} />
                      <span>{child.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <header className="h-12 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-4 bg-white dark:bg-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-slate-400">
              {navItems.find(s => s.children?.some(c => c.id === activeComponent))?.label}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
            <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {navItems.flatMap(s => s.children || []).find(c => c.id === activeComponent)?.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button className="p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Component Preview */}
        <div className="flex-1 overflow-auto p-8 bg-gray-50 dark:bg-slate-800/50">
          <div className="max-w-4xl mx-auto">
            <ComponentPreview componentId={activeComponent} />
          </div>
        </div>
      </main>
    </div>
  )
}

function ComponentPreview({ componentId }: { componentId: ComponentId }) {
  const [showPassword, setShowPassword] = useState(false)

  switch (componentId) {
    // Button variants
    case 'button-primary':
      return (
        <PreviewCard title="Primary Button" description="The primary button is used for main actions.">
          <div className="flex flex-wrap gap-4">
            <Button variant="primary">Primary Button</Button>
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="primary" size="lg">Large</Button>
          </div>
        </PreviewCard>
      )
    case 'button-secondary':
      return (
        <PreviewCard title="Secondary Button" description="Secondary buttons are used for less prominent actions.">
          <div className="flex flex-wrap gap-4">
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="secondary" size="sm">Small</Button>
            <Button variant="secondary" size="lg">Large</Button>
          </div>
        </PreviewCard>
      )
    case 'button-outline':
      return (
        <PreviewCard title="Outline Button" description="Outline buttons have a transparent background with a border.">
          <div className="flex flex-wrap gap-4">
            <Button variant="outline">Outline Button</Button>
            <Button variant="outline" size="sm">Small</Button>
            <Button variant="outline" size="lg">Large</Button>
          </div>
        </PreviewCard>
      )
    case 'button-ghost':
      return (
        <PreviewCard title="Ghost Button" description="Ghost buttons have no background or border until hovered.">
          <div className="flex flex-wrap gap-4">
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="ghost" size="sm">Small</Button>
            <Button variant="ghost" size="lg">Large</Button>
          </div>
        </PreviewCard>
      )
    case 'button-danger':
      return (
        <PreviewCard title="Danger Button" description="Danger buttons are used for destructive actions.">
          <div className="flex flex-wrap gap-4">
            <Button variant="danger">Delete</Button>
            <Button variant="danger"><Trash2 className="w-4 h-4 mr-2" />Delete Item</Button>
          </div>
        </PreviewCard>
      )
    case 'button-sizes':
      return (
        <PreviewCard title="Button Sizes" description="Buttons come in three sizes: small, medium, and large.">
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </PreviewCard>
      )
    case 'button-icons':
      return (
        <PreviewCard title="Buttons with Icons" description="Icons can be added to buttons for better visual communication.">
          <div className="flex flex-wrap gap-4">
            <Button variant="primary"><Plus className="w-4 h-4 mr-2" />Add Item</Button>
            <Button variant="secondary"><Download className="w-4 h-4 mr-2" />Export</Button>
            <Button variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
            <Button variant="ghost" className="p-2"><Settings className="w-5 h-5" /></Button>
            <Button variant="ghost" className="p-2"><Bell className="w-5 h-5" /></Button>
          </div>
        </PreviewCard>
      )
    case 'button-states':
      return (
        <PreviewCard title="Button States" description="Buttons can be in different states: normal, disabled, or loading.">
          <div className="flex flex-wrap gap-4">
            <Button variant="primary">Normal</Button>
            <Button variant="primary" disabled>Disabled</Button>
            <Button variant="primary" className="opacity-75">
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />Loading...
            </Button>
          </div>
        </PreviewCard>
      )

    // Card variants
    case 'card-basic':
      return (
        <PreviewCard title="Basic Card" description="A simple card with content only.">
          <Card>
            <CardContent className="p-6">
              <p className="text-gray-600 dark:text-slate-400">This is a basic card with some content inside.</p>
            </CardContent>
          </Card>
        </PreviewCard>
      )
    case 'card-header':
      return (
        <PreviewCard title="Card with Header" description="Cards can have a header section for titles.">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Card Title</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">Card subtitle or description</p>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-slate-400">This card has a header with a title and description.</p>
            </CardContent>
          </Card>
        </PreviewCard>
      )
    case 'card-footer':
      return (
        <PreviewCard title="Card with Footer" description="Cards can have a footer section for actions.">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Confirm Action</h3>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-slate-400">Are you sure you want to proceed with this action?</p>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="ghost">Cancel</Button>
              <Button variant="primary">Confirm</Button>
            </CardFooter>
          </Card>
        </PreviewCard>
      )
    case 'card-interactive':
      return (
        <PreviewCard title="Interactive Cards" description="Cards can be clickable with hover effects.">
          <div className="grid grid-cols-2 gap-4">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-slate-100">Clickable Card</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Hover to see effect</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-slate-100">Info Card</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">With accent border</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </PreviewCard>
      )
    case 'card-status':
      return (
        <PreviewCard title="Status Cards" description="Cards can indicate different statuses with colors.">
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-l-4 border-l-green-500 bg-green-50 dark:bg-green-900/20">
              <CardContent className="p-4 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-800 dark:text-green-300">Success</span>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
              <CardContent className="p-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <span className="font-medium text-yellow-800 dark:text-yellow-300">Warning</span>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/20">
              <CardContent className="p-4 flex items-center gap-2">
                <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="font-medium text-red-800 dark:text-red-300">Error</span>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20">
              <CardContent className="p-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="font-medium text-blue-800 dark:text-blue-300">Info</span>
              </CardContent>
            </Card>
          </div>
        </PreviewCard>
      )

    // Input variants
    case 'input-default':
      return (
        <PreviewCard title="Default Input" description="A basic text input field.">
          <div className="max-w-md">
            <Input placeholder="Enter text..." />
          </div>
        </PreviewCard>
      )
    case 'input-label':
      return (
        <PreviewCard title="Input with Label" description="Inputs can have labels for better accessibility.">
          <div className="max-w-md space-y-4">
            <Input label="Email Address" placeholder="you@example.com" type="email" />
            <Input label="Password" placeholder="Enter password" type="password" />
          </div>
        </PreviewCard>
      )
    case 'input-error':
      return (
        <PreviewCard title="Input Error State" description="Inputs can show error states with messages.">
          <div className="max-w-md">
            <Input 
              label="Username" 
              placeholder="Enter username" 
              error={true}
              errorMessage="Username is already taken"
            />
          </div>
        </PreviewCard>
      )
    case 'input-sizes':
      return (
        <PreviewCard title="Input Sizes" description="Inputs come in three sizes: small, medium, and large.">
          <div className="max-w-md space-y-4">
            <Input size="sm" placeholder="Small input" />
            <Input size="md" placeholder="Medium input (default)" />
            <Input size="lg" placeholder="Large input" />
          </div>
        </PreviewCard>
      )
    case 'input-special':
      return (
        <PreviewCard title="Special Inputs" description="Inputs with icons and special functionality.">
          <div className="max-w-md space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
              <Input className="pl-10" placeholder="Search..." />
            </div>
            <div className="relative">
              <Input 
                type={showPassword ? 'text' : 'password'} 
                placeholder="Enter password"
                className="pr-10"
              />
              <button 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-slate-400"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </PreviewCard>
      )

    // Foundations
    case 'colors':
      return <ColorsPreview />
    case 'typography':
      return <TypographyPreview />
    case 'icons':
      return <IconsPreview />
    case 'spacing':
      return <SpacingPreview />

    default:
      return <div>Select a component</div>
  }
}

function PreviewCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">{title}</h2>
        <p className="text-gray-500 dark:text-slate-400 mt-1">{description}</p>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  )
}

function ColorsPreview() {
  const colorGroups = [
    {
      name: 'Primary',
      colors: [
        { name: '50', value: '#eff6ff' },
        { name: '100', value: '#dbeafe' },
        { name: '500', value: '#3b82f6' },
        { name: '600', value: '#2563eb' },
        { name: '700', value: '#1d4ed8' },
        { name: '900', value: '#1e3a8a' },
      ]
    },
    {
      name: 'Neutral',
      colors: [
        { name: '50', value: '#fafafa' },
        { name: '100', value: '#f5f5f5' },
        { name: '500', value: '#737373' },
        { name: '700', value: '#404040' },
        { name: '900', value: '#171717' },
      ]
    },
    {
      name: 'Semantic',
      colors: [
        { name: 'Success', value: '#22c55e' },
        { name: 'Warning', value: '#f59e0b' },
        { name: 'Error', value: '#ef4444' },
        { name: 'Info', value: '#3b82f6' },
      ]
    },
  ]

  return (
    <PreviewCard title="Color Palette" description="The color system used throughout the application.">
      <div className="space-y-6">
        {colorGroups.map((group) => (
          <div key={group.name}>
            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">{group.name}</h3>
            <div className="flex flex-wrap gap-3">
              {group.colors.map((color) => (
                <div key={color.name} className="text-center">
                  <div 
                    className="w-14 h-14 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700"
                    style={{ backgroundColor: color.value }}
                  />
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">{color.name}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PreviewCard>
  )
}

function TypographyPreview() {
  return (
    <PreviewCard title="Typography" description="Text styles and font sizes used in the design system.">
      <div className="space-y-4">
        <div className="pb-4 border-b border-gray-100 dark:border-slate-700">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Heading 1</h1>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">text-3xl font-bold</p>
        </div>
        <div className="pb-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">Heading 2</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">text-2xl font-semibold</p>
        </div>
        <div className="pb-4 border-b border-gray-100 dark:border-slate-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Heading 3</h3>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">text-xl font-semibold</p>
        </div>
        <div className="pb-4 border-b border-gray-100 dark:border-slate-700">
          <p className="text-base text-gray-700 dark:text-slate-300">Body text - The quick brown fox jumps over the lazy dog.</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">text-base</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-slate-400">Small text - Used for captions and secondary information.</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">text-sm</p>
        </div>
      </div>
    </PreviewCard>
  )
}

function IconsPreview() {
  const icons = [
    { Icon: Check, name: 'Check' },
    { Icon: X, name: 'X' },
    { Icon: AlertTriangle, name: 'Alert' },
    { Icon: Info, name: 'Info' },
    { Icon: Search, name: 'Search' },
    { Icon: Plus, name: 'Plus' },
    { Icon: Trash2, name: 'Trash' },
    { Icon: Edit, name: 'Edit' },
    { Icon: Download, name: 'Download' },
    { Icon: Upload, name: 'Upload' },
    { Icon: RefreshCw, name: 'Refresh' },
    { Icon: Settings, name: 'Settings' },
    { Icon: User, name: 'User' },
    { Icon: Bell, name: 'Bell' },
    { Icon: Menu, name: 'Menu' },
    { Icon: Eye, name: 'Eye' },
  ]

  return (
    <PreviewCard title="Icons" description="Lucide React icons used in the application.">
      <div className="grid grid-cols-8 gap-4">
        {icons.map(({ Icon, name }) => (
          <div key={name} className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
            <Icon className="w-5 h-5 text-gray-700 dark:text-slate-300" />
            <span className="text-xs text-gray-500 dark:text-slate-400 mt-2">{name}</span>
          </div>
        ))}
      </div>
    </PreviewCard>
  )
}

function SpacingPreview() {
  const spacings = [
    { name: '1', value: '4px' },
    { name: '2', value: '8px' },
    { name: '4', value: '16px' },
    { name: '6', value: '24px' },
    { name: '8', value: '32px' },
  ]

  return (
    <PreviewCard title="Spacing" description="The spacing scale used for margins and paddings.">
      <div className="space-y-3">
        {spacings.map((spacing) => (
          <div key={spacing.name} className="flex items-center gap-4">
            <span className="w-8 text-sm text-gray-500 dark:text-slate-400 font-mono">{spacing.name}</span>
            <div 
              className="h-4 bg-blue-500 rounded"
              style={{ width: spacing.value }}
            />
            <span className="text-sm text-gray-600 dark:text-slate-400">{spacing.value}</span>
          </div>
        ))}
      </div>
    </PreviewCard>
  )
}
