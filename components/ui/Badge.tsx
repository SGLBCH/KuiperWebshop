import React from 'react'

type BadgeVariant =
  | 'pending'
  | 'approved'
  | 'active'
  | 'concept'
  | 'inactive'
  | 'info'
  | 'danger'
  | 'warning'
  | 'verstuurd'
  | 'gearchiveerd'

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  pending: 'bg-amber-100 text-amber-800 border border-amber-200',
  approved: 'bg-green-100 text-green-800 border border-green-200',
  active: 'bg-green-100 text-green-800 border border-green-200',
  concept: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  inactive: 'bg-gray-100 text-gray-600 border border-gray-200',
  info: 'bg-blue-100 text-blue-700 border border-blue-200',
  danger: 'bg-red-100 text-red-700 border border-red-200',
  warning: 'bg-orange-100 text-orange-700 border border-orange-200',
  verstuurd: 'bg-purple-100 text-purple-700 border border-purple-200',
  gearchiveerd: 'bg-gray-100 text-gray-500 border border-gray-200',
}

export function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
