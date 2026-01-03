"use client"

import { SMSPermissionPopup, useSMSPermissionPopup } from './sms-permission-popup'
import React from 'react'

export function SMSPopupWrapper() {
  const { shouldShowPopup, enableSMS, dismissPopup } = useSMSPermissionPopup()

  // Prevent popup on landing page or root
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname
    if (pathname === '/landing' || pathname === '/login' || pathname === '/' || pathname === '/browse' || pathname === '/signup') {
      return null
    }
  }

  return (
    <SMSPermissionPopup
      isOpen={shouldShowPopup}
      onClose={dismissPopup}
      onEnableSMS={enableSMS}
    />
  )
} 