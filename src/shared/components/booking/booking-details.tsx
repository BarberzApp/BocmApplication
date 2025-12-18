'use client'

import { useState } from 'react'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { Button } from '@/shared/components/ui/button'
import { logger } from '@/shared/lib/logger'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog'
import { useToast } from '@/shared/components/ui/use-toast'
import { Booking } from '@/shared/types/booking'
import { syncService } from '@/shared/lib/sync-service'
import { format } from 'date-fns'

interface BookingDetailsProps {
  booking: Booking | null
  isOpen: boolean
  onClose: () => void
  onBookingCancelled: (bookingId: string) => void
}

export function BookingDetails({ booking, isOpen, onClose, onBookingCancelled }: BookingDetailsProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  if (!booking) return null

  const handleCancel = async () => {
    if (!user || !syncService) return

    // Additional safety check
    if (!booking || !booking.id) {
      logger.error('No valid booking to cancel');
      toast({
        title: "Error",
        description: "Invalid booking data",
        variant: "destructive",
      });
      return;
    }

    // Prevent cancellation of already cancelled bookings
    if (booking.status === 'cancelled') {
      toast({
        title: "Already Cancelled",
        description: "This booking has already been cancelled.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true)
    try {
      logger.debug(`Cancelling booking ${booking.id} for user ${user.id}`);
      
      await syncService.cancelBooking(booking.id)
      
      logger.debug(`Successfully cancelled booking ${booking.id}`);
      
      toast({
        title: "Booking cancelled",
        description: "Your booking has been cancelled successfully.",
      })
      onBookingCancelled(booking.id)
      onClose()
    } catch (error) {
      logger.error(`Failed to cancel booking ${booking.id}`, error);
      toast({
        title: "Error",
        description: "Failed to cancel booking. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Booking Details</DialogTitle>
          <DialogDescription>
            View detailed information about your booking including date, time, service, and status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Date</h4>
              <p>{format(new Date(booking.date), 'PPP')}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Time</h4>
              <p>{format(new Date(booking.date), 'p')}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Service</h4>
              <p className="capitalize">{booking.service.name}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
              <p className="capitalize">{booking.status}</p>
            </div>
          </div>

          {booking.notes && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Notes</h4>
              <p>{booking.notes}</p>
            </div>
          )}

          {booking.status === 'pending' && (
            <DialogFooter>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowCancelConfirm(true)}
                disabled={loading}
              >
                {loading ? "Cancelling..." : "Cancel Booking"}
              </Button>
            </DialogFooter>
          )}
        </div>

        <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Booking</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this booking? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <p>Are you sure you want to cancel this booking?</p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCancelConfirm(false)}
              >
                No, keep it
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancel}
                disabled={loading}
              >
                Yes, cancel it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
} 