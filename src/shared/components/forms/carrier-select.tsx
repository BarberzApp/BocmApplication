'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Label } from '@/shared/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { Phone, Check, Info } from 'lucide-react'
import { CARRIER_OPTIONS } from '@/shared/constants/settings'

interface CarrierSelectProps {
  value?: string
  onChange: (value: string) => void
  error?: boolean
  label?: string
  showTooltip?: boolean
  className?: string
}

export function CarrierSelect({ 
  value, 
  onChange, 
  error = false, 
  label = 'Carrier *',
  showTooltip = true,
  className = ''
}: CarrierSelectProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="flex items-center gap-2 text-white font-medium">
        <Phone className="h-4 w-4 text-secondary" />
        {label}
        {showTooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-secondary cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent>
                <span>We need your carrier to send you free SMS reminders. If you're unsure, check your phone bill or carrier app.</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={`h-12 px-4 bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary focus:ring-2 focus:ring-secondary/40 rounded-xl shadow-sm flex items-center gap-2 ${error ? 'border-red-400' : ''}`}>
          <Phone className="h-4 w-4 text-secondary mr-2" />
          <SelectValue placeholder="Select your carrier…" />
        </SelectTrigger>
        <SelectContent className="bg-darkpurple border-white/20 text-white">
          {CARRIER_OPTIONS.map((carrier) => (
            <SelectItem key={carrier.value} value={carrier.value} className="flex items-center justify-between px-4 py-2 hover:bg-secondary/10 rounded-lg transition-colors">
              <span>{carrier.label}</span>
              {value === carrier.value && <Check className="h-4 w-4 text-secondary ml-2" />}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

