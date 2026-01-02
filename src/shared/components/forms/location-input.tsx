'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { MapPin } from 'lucide-react'
import { getAddressSuggestionsNominatim } from '@/shared/lib/geocode'
import { logger } from '@/shared/lib/logger'
import { useToast } from '@/shared/components/ui/use-toast'

interface LocationInputProps {
  value: string
  onChange: (value: string) => void
  onGeocode?: (lat: number, lon: number) => void
  error?: boolean
  label?: string
  placeholder?: string
  className?: string
}

export function LocationInput({
  value,
  onChange,
  onGeocode,
  error = false,
  label = 'Location *',
  placeholder = 'City, State or Zip Code',
  className = ''
}: LocationInputProps) {
  const [locationInput, setLocationInput] = useState(value)
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  // Sync with external value
  useEffect(() => {
    setLocationInput(value)
  }, [value])

  // Debounced fetch suggestions
  const debouncedFetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setLocationSuggestions([])
      return
    }
    
    setSuggestionsLoading(true)
    try {
      const suggestions = await getAddressSuggestionsNominatim(query)
      setLocationSuggestions(suggestions)
    } catch (error) {
      logger.error('Error fetching suggestions', error)
      setLocationSuggestions([])
    } finally {
      setSuggestionsLoading(false)
    }
  }, [])

  // Fetch suggestions as user types
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    if (showSuggestions && locationInput.length >= 3) {
      const timer = setTimeout(() => {
        debouncedFetchSuggestions(locationInput)
      }, 300)
      
      debounceTimerRef.current = timer
    } else if (locationInput.length < 3) {
      setLocationSuggestions([])
    }
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [locationInput, showSuggestions, debouncedFetchSuggestions])

  // Handle location input change
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value ?? ''
    setLocationInput(newValue)
    setShowSuggestions(true)
    onChange(newValue)
  }

  // Handle suggestion select
  const handleSuggestionSelect = (suggestion: any) => {
    const address = suggestion.address || {}
    const house = address.house_number || ''
    const road = address.road || ''
    const city = address.city || address.town || address.village || address.hamlet || ''
    const state = address.state || address.state_code || ''
    const line1 = [house, road].filter(Boolean).join(' ')
    const line2 = [city, state].filter(Boolean).join(', ')
    const formatted = [line1, line2].filter(Boolean).join(', ')
    
    setLocationInput(formatted)
    setShowSuggestions(false)
    setLocationSuggestions([])
    onChange(formatted)
    
    // Trigger geocoding if callback provided
    if (onGeocode && suggestion.lat && suggestion.lon) {
      onGeocode(parseFloat(suggestion.lat), parseFloat(suggestion.lon))
    }
  }

  // Validate location on blur
  const handleLocationBlur = async () => {
    setTimeout(async () => {
      if (!locationInput) return
      const geoSuggestions = await getAddressSuggestionsNominatim(locationInput)
      const geo = geoSuggestions && geoSuggestions.length > 0 
        ? { lat: parseFloat(geoSuggestions[0].lat), lon: parseFloat(geoSuggestions[0].lon) } 
        : null
      
      if (!geo) {
        toast({
          title: 'Invalid location',
          description: 'Please enter a valid place from the suggestions.',
          variant: 'destructive',
        })
        setLocationInput('')
        onChange('')
      } else if (onGeocode) {
        onGeocode(geo.lat, geo.lon)
      }
    }, 200)
  }

  return (
    <div className={`space-y-2 relative ${className}`}>
      <Label htmlFor="location" className="text-white font-semibold flex items-center gap-2">
        <MapPin className="h-4 w-4 text-secondary" />
        {label}
      </Label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary" />
        <Input
          id="location"
          placeholder={placeholder}
          className={`pl-10 bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl ${error ? 'border-red-400' : ''}`}
          value={locationInput}
          onChange={handleLocationChange}
          onFocus={() => setShowSuggestions(true)}
          onBlur={handleLocationBlur}
          autoComplete="off"
        />
        {/* Suggestions dropdown */}
        {showSuggestions && (locationSuggestions.length > 0 || suggestionsLoading) && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-black border border-white/20 rounded-xl shadow-xl max-h-48 overflow-y-auto">
            {suggestionsLoading && (
              <div className="px-4 py-2 text-white/60 text-sm">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary"></div>
                  Searching...
                </div>
              </div>
            )}
            {locationSuggestions.map((s, i) => (
              <button
                key={`${s.place_id || i}-${s.display_name}`}
                type="button"
                className="w-full text-left px-4 py-2 text-white hover:bg-secondary/20"
                onMouseDown={() => handleSuggestionSelect(s)}
              >
                {s.display_name || s.name || 'Unknown location'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

