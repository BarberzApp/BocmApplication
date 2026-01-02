'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { MapPin } from 'lucide-react'

interface SimpleLocationInputProps {
  value: string
  onChange: (value: string) => void
  error?: boolean
  className?: string
}

/**
 * Parses location string into address and city
 */
function parseLocation(location: string): { address: string; city: string } {
  if (!location) return { address: '', city: '' }
  
  const locationStr = location.trim()
  
  // Format: "Address, City, State ZIP" or "Address, City, State"
  const fullMatch = locationStr.match(/^(.+?),\s*([^,]+?)(?:,\s*[A-Za-z]{2,}\s*\d{5}?)?$/)
  if (fullMatch) {
    return {
      address: fullMatch[1].trim(),
      city: fullMatch[2].trim()
    }
  }
  
  // Format: "Address, City State ZIP" or "Address, City State"
  const cityStateMatch = locationStr.match(/^(.+?),\s*([^,]+?)(?:\s+[A-Za-z]{2,}\s*\d{5}?)?$/)
  if (cityStateMatch) {
    return {
      address: cityStateMatch[1].trim(),
      city: cityStateMatch[2].trim()
    }
  }
  
  // Fallback: split by comma
  const parts = locationStr.split(',').map((part: string) => part.trim())
  if (parts.length >= 2) {
    return { address: parts[0], city: parts[1] }
  }
  
  return { address: locationStr, city: '' }
}

/**
 * Combines address and city into location string
 */
function combineLocation(address: string, city: string): string {
  const parts = [address, city].filter(Boolean)
  return parts.join(', ')
}

export function SimpleLocationInput({ value, onChange, error = false, className = '' }: SimpleLocationInputProps) {
  const parsed = parseLocation(value)
  const [address, setAddress] = useState(parsed.address)
  const [city, setCity] = useState(parsed.city)

  // Sync with external value
  useEffect(() => {
    const parsed = parseLocation(value)
    setAddress(parsed.address)
    setCity(parsed.city)
  }, [value])

  const handleAddressChange = (newAddress: string) => {
    setAddress(newAddress)
    onChange(combineLocation(newAddress, city))
  }

  const handleCityChange = (newCity: string) => {
    setCity(newCity)
    onChange(combineLocation(address, newCity))
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <Label htmlFor="address" className="text-white font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4 text-secondary" />
          Address
        </Label>
        <Input
          id="address"
          type="text"
          className={`bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary ${error ? 'border-red-400' : ''}`}
          value={address}
          onChange={(e) => handleAddressChange(e.target.value)}
          placeholder="123 Main St"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="city" className="text-white font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4 text-secondary" />
          City
        </Label>
        <Input
          id="city"
          type="text"
          className={`bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary ${error ? 'border-red-400' : ''}`}
          value={city}
          onChange={(e) => handleCityChange(e.target.value)}
          placeholder="New York"
        />
      </div>
    </div>
  )
}

