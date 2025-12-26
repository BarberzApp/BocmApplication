"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/shared/components/ui/use-toast"
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { supabaseAdmin } from "@/shared/lib/supabase"
import { logger } from "@/shared/lib/logger"

export default function BookingSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const sessionId = searchParams.session_id
  const { push: safePush } = useSafeNavigation();

  useEffect(() => {
    const handleSuccess = async () => {
      if (!sessionId) {
        toast({
          title: "Error",
          description: "No session ID provided",
          variant: "destructive",
        })
        safePush('/')
        return
      }

      try {
        logger.debug('Payment successful', { sessionId })
        
        // Verify the session was successful
        const response = await fetch(`/api/payments/session?session_id=${sessionId}`)
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(`Failed to verify payment: ${errorData.error || response.statusText}`)
        }
        
        const session = await response.json()
        logger.debug('Payment verified', {
          id: session.id,
          payment_status: session.payment_status,
          amount_total: session.amount_total
        })

        // Check if booking was created by webhook
        const { data: existingBooking } = await supabaseAdmin
          .from('bookings')
          .select('id, status, payment_status')
          .eq('payment_intent_id', session.payment_intent)
          .single()

        if (existingBooking) {
          logger.debug('Booking created by webhook', { bookingId: existingBooking.id })
          toast({
            title: "Payment Successful!",
            description: "Your booking has been confirmed and you'll receive a confirmation shortly.",
          })
        } else {
          logger.debug('Booking being created by webhook')
          toast({
            title: "Payment Successful!",
            description: "Your payment was processed successfully. Your booking will be confirmed shortly.",
          })
        }

      } catch (error) {
        logger.error('Error verifying payment', error)
        // Don't show error to user since payment was successful
        // The webhook will handle booking creation
        toast({
          title: "Payment Successful!",
          description: "Your payment was processed successfully. Your booking will be confirmed shortly.",
        })
      }
    }

    handleSuccess()
  }, [sessionId, router, toast])

  return (
    <div className="container max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Payment Successful! 🎉</CardTitle>
          <CardDescription>
            Your payment has been processed and your booking will be confirmed shortly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">
              ✅ Your payment was successful! 
            </p>
            <p className="text-green-700 text-sm mt-2">
              Your booking is being processed automatically. You'll receive a confirmation email and SMS shortly.
            </p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 font-medium">What happens next?</p>
            <ul className="text-blue-700 text-sm mt-2 space-y-1">
              <li>• Your booking will be created automatically</li>
              <li>• You'll receive a confirmation email</li>
              <li>• You'll get an SMS notification</li>
              <li>• The barber will be notified of your appointment</li>
            </ul>
          </div>
          
          <Button onClick={() => safePush('/')} className="w-full">
            Return to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  )
} 