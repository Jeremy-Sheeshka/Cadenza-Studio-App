// shadcn/ui-style components — matching the production app's design system.
// hsl(var(--primary)) = teal 173 80% 40% from extracted CSS variables.

import { cva, type VariantProps } from "class-variance-authority"
import { createContext, useContext, useState, useCallback, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, forwardRef } from 'react'
import { X, Inbox } from 'lucide-react'
import { cn } from '../lib/utils'

// ─── Button ──────────────────────────────────────────────────────────────────

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-slate-900 text-white hover:bg-slate-800",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-900",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
        ghost: "hover:bg-slate-100 hover:text-slate-900",
        link: "text-slate-900 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
))
Button.displayName = "Button"
export { Button, buttonVariants }

// ─── Input ───────────────────────────────────────────────────────────────────

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input type={type}
    className={cn(
      "flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400",
      "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "file:border-0 file:bg-transparent file:text-sm file:font-medium",
      className
    )}
    ref={ref} {...props}
  />
))
Input.displayName = "Input"
export { Input }

// ─── Card ────────────────────────────────────────────────────────────────────

const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm", className)} {...props} />
))
Card.displayName = "Card"

const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-5 pb-0", className)} {...props} />
))
CardHeader.displayName = "CardHeader"

const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

export { Card, CardHeader, CardContent }

// ─── Badge ───────────────────────────────────────────────────────────────────

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-slate-900 text-white",
        secondary: "border-transparent bg-slate-100 text-slate-900",
        destructive: "border-transparent bg-red-100 text-red-800",
        outline: "text-slate-900",
        teal: "border-transparent bg-blue-50 text-blue-800",
        green: "border-transparent bg-indigo-50 text-indigo-700",
        amber: "border-transparent bg-amber-50 text-amber-700",
        purple: "border-transparent bg-violet-50 text-violet-700",
        blue: "border-transparent bg-blue-50 text-blue-700",
        slate: "border-transparent bg-slate-100 text-slate-600",
        red: "border-transparent bg-red-50 text-red-700",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
export { Badge, badgeVariants }

// ─── Select ──────────────────────────────────────────────────────────────────

const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }>(
  ({ className, options, placeholder, ...props }, ref) => (
    <select ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm",
        "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
)
Select.displayName = "Select"
export { Select }

// ─── PageHeader ──────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="mt-2 sm:mt-0">{action}</div>}
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto pt-10 sm:pt-20">
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-200", className)} {...props} />
}
export { Skeleton }

// ─── EmptyState ──────────────────────────────────────────────────────────────

export function EmptyState({ icon: Icon, title, description, action }: {
  icon?: typeof Inbox; title: string; description?: string; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 py-16 px-4 text-center">
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <Icon className="h-6 w-6 text-slate-400" />
        </div>
      )}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ─── PrimaryButton (convenience) ─────────────────────────────────────────────

export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm" {...props} />
}

// ─── Toast ───────────────────────────────────────────────────────────────────

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }

const ToastContext = createContext<{ toast: (msg: string, type?: Toast['type']) => void }>({ toast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [nextId, setNextId] = useState(0)

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = nextId
    setNextId((n) => n + 1)
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [nextId])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={cn(
            "animate-in slide-in-from-bottom-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg",
            t.type === 'success' && 'border-indigo-200 bg-indigo-50 text-indigo-800',
            t.type === 'error' && 'border-red-200 bg-red-50 text-red-800',
            t.type === 'info' && 'border-slate-200 bg-white text-slate-800',
          )}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() { return useContext(ToastContext) }
