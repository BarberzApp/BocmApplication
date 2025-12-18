"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Input } from '@/shared/components/ui/input'
import { Bell, X, MessageSquare, Shield, CheckCircle, Phone } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { logger } from '@/shared/lib/logger'

interface SMSPermissionPopupProps {
  isOpen: boolean
  onClose: () => void
  onEnableSMS: () => void
}

export function SMSPermissionPopup({ isOpen, onClose, onEnableSMS }: SMSPermissionPopupProps) {
  const { user } = useAuth()
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [carrier, setCarrier] = useState('')
  const [step, setStep] = useState<'info' | 'details'>('info')

  // Debug popup render
  logger.debug('SMS Popup Render', { isOpen, step })

  // Auto-fill phone and carrier when popup opens
  useEffect(() => {
    if (isOpen && step === 'details') {
      // Priority 1: Try to get from localStorage (previously saved)
      const savedPhone = localStorage.getItem('sms-phone-number')
      const savedCarrier = localStorage.getItem('sms-carrier')
      
      if (savedPhone) {
        setPhoneNumber(savedPhone)
      } else if (user?.phone) {
        // Priority 2: Try to get from user profile
        setPhoneNumber(user.phone)
      }

      if (savedCarrier) {
        setCarrier(savedCarrier)
      }
    }
  }, [isOpen, step, user])

  const handleEnableSMS = async () => {
    if (step === 'info') {
      setStep('details')
      return
    }

    if (!phoneNumber || !carrier) {
      return
    }

    setIsLoading(true)
    try {
      // Call the parent's SMS enable function with phone and carrier data
      await onEnableSMS()
      
      // Save phone and carrier info
      localStorage.setItem('sms-phone-number', phoneNumber)
      localStorage.setItem('sms-carrier', carrier)
      
      // If user checked "don't show again", save to localStorage
      if (dontShowAgain) {
        localStorage.setItem('sms-permission-dismissed', 'true')
      }
      
      onClose()
    } catch (error) {
      logger.error('Error enabling SMS', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDismiss = () => {
    // If user checked "don't show again", save to localStorage
    if (dontShowAgain) {
      localStorage.setItem('sms-permission-dismissed', 'true')
    }
    // Reset form state
    setStep('info')
    setPhoneNumber('')
    setCarrier('')
    onClose()
  }

  // Carrier options
  const carriers = [
    { value: 'verizon', label: 'Verizon' },
    { value: 'att', label: 'AT&T' },
    { value: 'tmobile', label: 'T-Mobile' },
    { value: 'sprint', label: 'Sprint' },
    { value: 'boost', label: 'Boost Mobile' },
    { value: 'cricket', label: 'Cricket Wireless' },
    { value: 'metro', label: 'Metro by T-Mobile' },
    { value: 'straight-talk', label: 'Straight Talk' },
    { value: 'other', label: 'Other' }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full bg-black/95 border border-white/20 backdrop-blur-xl rounded-3xl shadow-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="relative p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center">
              <Bell className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white">
                {step === 'info' ? 'Stay Updated!' : 'Enter Your Details'}
              </DialogTitle>
              <DialogDescription className="text-white/60 mt-1">
                {step === 'info' 
                  ? 'Enable SMS notifications for the best experience'
                  : 'We need your phone number and carrier to send you notifications'
                }
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {step === 'info' ? (
            <>
              {/* Benefits */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-sm">Booking Confirmations</h4>
                    <p className="text-white/60 text-xs">Get instant confirmation when your appointment is booked</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MessageSquare className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-sm">Reminder Notifications</h4>
                    <p className="text-white/60 text-xs">Never miss your appointment with timely reminders</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Shield className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-sm">Secure & Private</h4>
                    <p className="text-white/60 text-xs">Your information is protected and never shared</p>
                  </div>
                </div>
              </div>

              {/* Don't show again checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dont-show-again"
                  checked={dontShowAgain}
                  onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
                  className="border-white/30 bg-white/10 rounded focus:ring-secondary"
                />
                <Label 
                  htmlFor="dont-show-again" 
                  className="text-white/80 text-sm cursor-pointer hover:text-white transition-colors"
                >
                  Don't show me this again
                </Label>
              </div>
            </>
          ) : (
            <>
              {/* Phone Number Input */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white font-medium text-sm">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    id="phone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="(555) 123-4567"
                    autoComplete="tel"
                    name="phone"
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl"
                  />
                </div>
                <p className="text-white/50 text-xs">We'll send you a verification code</p>
              </div>

              {/* Carrier Selection */}
              <div className="space-y-2">
                <Label htmlFor="carrier" className="text-white font-medium text-sm">Mobile Carrier</Label>
                <Select value={carrier} onValueChange={setCarrier}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white focus:border-secondary rounded-xl">
                    <SelectValue placeholder="Select your carrier" />
                  </SelectTrigger>
                  <SelectContent className="bg-black/95 border-white/20">
                    {carriers.map((carrierOption) => (
                      <SelectItem 
                        key={carrierOption.value} 
                        value={carrierOption.value}
                        className="text-white hover:bg-white/10 focus:bg-white/10"
                      >
                        {carrierOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-white/50 text-xs">This helps us deliver messages reliably</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 space-y-3">
          <Button
            onClick={handleEnableSMS}
            disabled={isLoading || (step === 'details' && (!phoneNumber || !carrier))}
            className="w-full bg-secondary text-black font-semibold rounded-xl hover:bg-secondary/90 transition-all duration-300"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2" />
                {step === 'info' ? 'Loading...' : 'Enabling...'}
              </>
            ) : (
              <>
                {step === 'info' ? (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Continue
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Enable SMS Notifications
                  </>
                )}
              </>
            )}
          </Button>
          
          {step === 'info' && (
            <Button
              onClick={handleDismiss}
              variant="ghost"
              className="w-full text-white/60 hover:text-white hover:bg-white/10 rounded-xl"
            >
              Maybe Later
            </Button>
          )}
          
          {step === 'details' && (
            <Button
              onClick={() => setStep('info')}
              variant="ghost"
              className="w-full text-white/60 hover:text-white hover:bg-white/10 rounded-xl"
            >
              Back
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook to check if SMS permission popup should be shown
export function useSMSPermissionPopup() {
  const [shouldShowPopup, setShouldShowPopup] = useState(false)

  useEffect(() => {
    // Check if user has already dismissed the popup
    const isDismissed = localStorage.getItem('sms-permission-dismissed') === 'true'

    // Get SMS state from localStorage (popup) and profile (if available)
    const isSMSEnabled = localStorage.getItem('sms-notifications-enabled') === 'true'
    const hasPhoneNumber = localStorage.getItem('sms-phone-number')
    const hasCarrier = localStorage.getItem('sms-carrier')

    // For debugging: also check profile fields if available
    const profileSMS = localStorage.getItem('sms_notifications') === 'true'
    const profilePhone = localStorage.getItem('profile_phone')
    const profileCarrier = localStorage.getItem('profile_carrier')

    // Final values to use (prefer profile if present, else popup/localStorage)
    const smsEnabled = isSMSEnabled || profileSMS
    const phone = hasPhoneNumber || profilePhone
    const carrier = hasCarrier || profileCarrier

    // Show popup if NOT (all three: enabled, phone, carrier)
    const shouldShow = !smsEnabled || !phone || !carrier

    // Debug logging
    logger.debug('SMS Popup Debug', {
      isDismissed,
      isSMSEnabled,
      hasPhoneNumber,
      hasCarrier,
      profileSMS,
      profilePhone,
      profileCarrier,
      smsEnabled,
      phone,
      carrier,
      shouldShow
    })

    if (!isDismissed && shouldShow) {
      logger.debug('Showing SMS popup (missing one or more required fields)')
      setShouldShowPopup(true)
    } else {
      logger.debug('Not showing SMS popup (all required fields present or dismissed)')
    }
  }, [])

  const enableSMS = async () => {
    try {
      localStorage.setItem('sms-notifications-enabled', 'true')
      return Promise.resolve()
    } catch (error) {
      logger.error('Error enabling SMS', error)
      return Promise.reject(error)
    }
  }

  const dismissPopup = () => {
    setShouldShowPopup(false)
  }

  return {
    shouldShowPopup,
    enableSMS,
    dismissPopup
  }
} 