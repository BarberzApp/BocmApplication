import { useState, useEffect } from 'react'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Package, DollarSign, Plus } from 'lucide-react'
import { ServiceAddon } from '@/shared/types/addon'
import { AddonService } from '@/shared/lib/addon-service'
import { logger } from '@/shared/lib/logger'

interface AddonSelectorProps {
  barberId: string
  selectedAddonIds: string[]
  onAddonChange: (addonIds: string[]) => void
  className?: string
}

export function AddonSelector({ 
  barberId, 
  selectedAddonIds, 
  onAddonChange, 
  className = "" 
}: AddonSelectorProps) {
  const [addons, setAddons] = useState<ServiceAddon[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAddons()
  }, [barberId])

  const loadAddons = async () => {
    try {
      setLoading(true)
      const barberAddons = await AddonService.getBarberAddons(barberId)
      setAddons(barberAddons)
    } catch (error) {
      logger.error('Error loading add-ons', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddonToggle = (addonId: string, checked: boolean) => {
    if (checked) {
      onAddonChange([...selectedAddonIds, addonId])
    } else {
      onAddonChange(selectedAddonIds.filter(id => id !== addonId))
    }
  }

  const getSelectedAddons = () => {
    return addons.filter(addon => selectedAddonIds.includes(addon.id))
  }

  const getTotalAddonCost = () => {
    return getSelectedAddons().reduce((total, addon) => total + addon.price, 0)
  }

  if (loading) {
    return (
      <Card className={`bg-white/5 border border-white/10 ${className}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (addons.length === 0) {
    return null // Don't show anything if no add-ons available
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="grid gap-4">
        {addons.map((addon) => (
          <div
            key={addon.id}
            className={`relative flex items-center bg-gradient-to-br from-white/5 to-white/3 border border-white/10 shadow-xl backdrop-blur-xl rounded-2xl p-5 group transition-all duration-300 hover:shadow-2xl hover:border-secondary/20 cursor-pointer ${selectedAddonIds.includes(addon.id) ? 'border-secondary bg-secondary/10' : ''}`}
            onClick={() => handleAddonToggle(addon.id, !selectedAddonIds.includes(addon.id))}
          >
            <div className="flex-shrink-0 flex flex-col items-center justify-center mr-5">
              <Checkbox
                id={addon.id}
                checked={selectedAddonIds.includes(addon.id)}
                onCheckedChange={(checked) => handleAddonToggle(addon.id, checked as boolean)}
                className="h-6 w-6 border-white/30 bg-white/10 rounded-lg focus:ring-secondary"
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4 mb-2">
                <h4 className="text-lg sm:text-xl font-bebas text-white tracking-wide flex-1">{addon.name}</h4>
                <Badge variant="glassy-secondary" className="text-sm px-3 py-1">${addon.price.toFixed(2)}</Badge>
              </div>
              {addon.description && (
                <p className="text-white/70 text-base leading-relaxed" style={{ whiteSpace: 'pre-line' }}>{addon.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {selectedAddonIds.length > 0 && (
        <div className="bg-gradient-to-br from-white/5 to-white/3 border border-secondary/20 shadow-xl backdrop-blur-xl rounded-2xl p-5 mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-secondary" />
              <span className="text-white font-medium">Selected Add-ons:</span>
              <Badge variant="glassy-secondary" className="text-sm px-3 py-1">{selectedAddonIds.length}</Badge>
            </div>
            <div className="flex items-center gap-1 text-secondary font-semibold text-lg">
              <DollarSign className="h-5 w-5" />
              <span>+{getTotalAddonCost().toFixed(2)}</span>
            </div>
          </div>
          <div className="mt-2 space-y-1">
            {getSelectedAddons().map((addon) => (
              <div key={addon.id} className="flex items-center justify-between text-sm">
                <span className="text-white/70">{addon.name}</span>
                <span className="text-secondary">+${addon.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 