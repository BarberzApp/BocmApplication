"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Search, Clock, TrendingUp, MapPin, Scissors } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { logger } from '@/shared/lib/logger'

interface SearchSuggestionsProps {
  onSuggestionClick: (suggestion: string) => void
  searchQuery: string
  className?: string
}

const POPULAR_SEARCHES = [
  'Haircut',
  'Beard Trim',
  'Fade',
  'Pompadour',
  'Undercut',
  'Classic Cut',
  'Modern Style',
  'Kids Haircut'
]

const POPULAR_LOCATIONS = [
  'Downtown',
  'Midtown',
  'Uptown',
  'Brooklyn',
  'Queens',
  'Manhattan'
]

export function SearchSuggestions({ onSuggestionClick, searchQuery, className = '' }: SearchSuggestionsProps) {
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('recent-searches')
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch (error) {
        logger.error('Error parsing recent searches', error)
      }
    }
  }, [])

  const addToRecentSearches = (search: string) => {
    const trimmed = search.trim()
    if (!trimmed) return

    const updated = [trimmed, ...recentSearches.filter(s => s !== trimmed)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('recent-searches', JSON.stringify(updated))
  }

  const handleSuggestionClick = (suggestion: string) => {
    addToRecentSearches(suggestion)
    onSuggestionClick(suggestion)
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    localStorage.removeItem('recent-searches')
  }

  // Don't show suggestions if there's already a search query
  if (searchQuery.trim()) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`space-y-6 ${className}`}
      >
        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Searches
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearRecentSearches}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((search, index) => (
                <motion.div
                  key={search}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestionClick(search)}
                    className="text-sm"
                  >
                    <Search className="h-3 w-3 mr-1" />
                    {search}
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Popular Searches */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Popular Services
          </h3>
          <div className="flex flex-wrap gap-2">
            {POPULAR_SEARCHES.map((search, index) => (
              <motion.div
                key={search}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestionClick(search)}
                  className="text-sm"
                >
                  <Scissors className="h-3 w-3 mr-1" />
                  {search}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Popular Locations */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Popular Locations
          </h3>
          <div className="flex flex-wrap gap-2">
            {POPULAR_LOCATIONS.map((location, index) => (
              <motion.div
                key={location}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestionClick(location)}
                  className="text-sm"
                >
                  <MapPin className="h-3 w-3 mr-1" />
                  {location}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
} 