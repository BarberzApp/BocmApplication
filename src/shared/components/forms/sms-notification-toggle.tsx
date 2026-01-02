'use client'

import { Button } from '@/shared/components/ui/button'
import { Check } from 'lucide-react'

interface SmsNotificationToggleProps {
  value: boolean
  onChange: (value: boolean) => void
  className?: string
}

export function SmsNotificationToggle({ value, onChange, className = '' }: SmsNotificationToggleProps) {
  return (
    <div className={className}>
      <Button
        type="button"
        size="sm"
        className={
          value
            ? 'bg-green-600 text-white font-semibold rounded-lg px-4 py-2 shadow flex items-center gap-2 hover:bg-green-700 transition cursor-default'
            : 'bg-secondary text-primary font-semibold rounded-lg px-4 py-2 shadow hover:bg-secondary/90 transition'
        }
        onClick={() => onChange(!value)}
        disabled={value}
      >
        {value ? (
          <>
            <Check className="h-4 w-4" /> SMS Notifications Enabled
          </>
        ) : (
          <>Enable SMS Notifications</>
        )}
      </Button>
    </div>
  )
}

