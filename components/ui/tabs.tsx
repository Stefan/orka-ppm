import * as React from 'react'

const TabsContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
}>({ value: '', onValueChange: () => {} })

const Tabs = ({ defaultValue, value: controlledValue, onValueChange, children, className = '' }: {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue || '')
  const value = controlledValue !== undefined ? controlledValue : internalValue
  const handleValueChange = onValueChange || setInternalValue

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

const TabsList = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={`inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground ${className}`}
      {...props}
    />
  )
}

const TabsTrigger = ({ value, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) => {
  const { value: selectedValue, onValueChange } = React.useContext(TabsContext)
  const isSelected = selectedValue === value

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isSelected ? 'bg-background text-foreground shadow-sm' : ''
      } ${className}`}
      onClick={() => onValueChange(value)}
      {...props}
    />
  )
}

const TabsContent = ({ value, className = '', ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) => {
  const { value: selectedValue } = React.useContext(TabsContext)
  
  if (selectedValue !== value) return null

  return (
    <div
      className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
