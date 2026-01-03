'use client'

import Link from 'next/link'
import { cn } from '@/shared/lib/utils'

interface LogoBrandProps {
  size?: 'sm' | 'md' | 'lg'
  showGlow?: boolean
  asLink?: boolean
  className?: string
}

const sizeClasses = {
  sm: {
    logo: 'h-8 w-8 sm:h-10 sm:w-10',
    text: 'text-2xl',
    spacing: 'ml-3'
  },
  md: {
    logo: 'h-16 w-16 sm:h-20 sm:w-20',
    text: 'text-4xl sm:text-5xl',
    spacing: 'ml-4'
  },
  lg: {
    logo: 'h-20 w-20 sm:h-24 sm:w-24',
    text: 'text-5xl sm:text-6xl',
    spacing: 'ml-5'
  }
}

export function LogoBrand({ 
  size = 'md', 
  showGlow = true, 
  asLink = false,
  className 
}: LogoBrandProps) {
  const classes = sizeClasses[size]
  
  const logoContent = (
    <div className={cn('flex items-center', className)}>
      <div className="relative">
        <img 
          src="/BocmLogo.png" 
          alt="BOCM Logo" 
          className={cn(
            classes.logo,
            asLink && 'transition-transform duration-300 group-hover:scale-110'
          )} 
        />
        {showGlow && (
          <div className={cn(
            'absolute inset-0 bg-saffron/20 rounded-full blur-xl',
            asLink ? 'opacity-0 group-hover:opacity-100 transition-opacity duration-300' : 'opacity-50'
          )} />
        )}
      </div>
      <span className={cn(
        'font-bebas font-bold text-saffron',
        classes.text,
        classes.spacing,
        asLink && 'group-hover:text-saffron/90 transition-colors duration-300'
      )}>
        BOCM
      </span>
    </div>
  )

  if (asLink) {
    return (
      <Link href="/" className="flex items-center group">
        {logoContent}
      </Link>
    )
  }

  return logoContent
}

