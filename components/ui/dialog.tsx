import * as React from 'react'

const Dialog = ({ open, onOpenChange, children }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) => {
  if (!open) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative z-50">{children}</div>
    </div>
  )
}

const DialogContent = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 max-w-lg w-full ${className}`} {...props}>
      {children}
    </div>
  )
}

const DialogHeader = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return <div className={`mb-4 ${className}`} {...props} />
}

const DialogTitle = ({ className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
  return <h2 className={`text-lg font-semibold ${className}`} {...props} />
}

const DialogDescription = ({ className = '', ...props }: React.HTMLAttributes<HTMLParagraphElement>) => {
  return <p className={`text-sm text-gray-600 ${className}`} {...props} />
}

const DialogFooter = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return <div className={`mt-6 flex justify-end gap-2 ${className}`} {...props} />
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }
