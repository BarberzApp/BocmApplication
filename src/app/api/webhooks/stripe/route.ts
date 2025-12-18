import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from "@/shared/lib/supabase"
import { headers } from "next/headers"
import { sendBookingConfirmationSMS } from '@/shared/utils/sendSMS'
import { logger } from '@/shared/lib/logger'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('Missing STRIPE_WEBHOOK_SECRET')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20" as any,
})

const supabase = supabaseAdmin

// Helper function to update booking status
async function updateBookingStatus(
  bookingId: string,
  status: string,
  paymentStatus: string,
  paymentIntentId?: string
) {
  // Validate inputs
  if (!bookingId || typeof bookingId !== 'string') {
    throw new Error('Invalid booking ID')
  }

  if (!status || typeof status !== 'string') {
    throw new Error('Invalid status')
  }

  if (!paymentStatus || typeof paymentStatus !== 'string') {
    throw new Error('Invalid payment status')
  }

  if (paymentIntentId !== undefined && typeof paymentIntentId !== 'string') {
    throw new Error('Invalid payment intent ID')
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      status,
      payment_status: paymentStatus,
      payment_intent_id: paymentIntentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)

  if (error) {
    logger.error('Error updating booking', error)
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature found' },
        { status: 400 }
      )
    }

    // Validate webhook secret is configured
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('STRIPE_WEBHOOK_SECRET is not configured')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      logger.error('Webhook signature verification failed', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Validate event type
    if (!event.type || typeof event.type !== 'string') {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      )
    }

    // Handle specific events
    switch (event.type as string) {
      case 'account.created': {
        const account = event.data.object as Stripe.Account
        logger.debug('Processing account.created event', { accountId: account.id })

        // Validate account object
        if (!account.id || typeof account.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid account ID' },
            { status: 400 }
          )
        }

        // Get barber ID from metadata
        const barberId = account.metadata?.barber_id
        if (!barberId) {
          logger.error('No barber ID found in account metadata')
          return NextResponse.json(
            { error: 'No barber ID found' },
            { status: 400 }
          )
        }

        // Update barber's Stripe account ID
        const { error: updateError } = await supabase
          .from('barbers')
          .update({
            stripe_account_id: account.id,
            stripe_account_status: 'pending',
            stripe_account_ready: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', barberId)

        if (updateError) {
          logger.error('Error updating barber', updateError)
          return NextResponse.json(
            { error: 'Failed to update barber' },
            { status: 500 }
          )
        }

        logger.debug('Successfully saved Stripe account ID for barber', { barberId })
        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        logger.debug('Processing account.updated event', { accountId: account.id })

        // Validate account object
        if (!account.id || typeof account.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid account ID' },
            { status: 400 }
          )
        }

        // Find barber with this Stripe account ID
        const { data: barber, error: findError } = await supabase
          .from('barbers')
          .select('id')
          .eq('stripe_account_id', account.id)
          .single()

        if (findError) {
          logger.error('Error finding barber', findError)
          return NextResponse.json(
            { error: 'Failed to find barber' },
            { status: 500 }
          )
        }

        if (!barber) {
          return NextResponse.json(
            { error: 'Barber not found' },
            { status: 404 }
          )
        }

        // Update barber's Stripe account status
        const { error: updateError } = await supabase
          .from('barbers')
          .update({
            stripe_account_status: account.charges_enabled ? 'active' : 'pending',
            stripe_account_ready: account.charges_enabled && account.details_submitted,
            updated_at: new Date().toISOString(),
          })
          .eq('id', barber.id)

        if (updateError) {
          logger.error('Error updating barber', updateError)
          return NextResponse.json(
            { error: 'Failed to update barber' },
            { status: 500 }
          )
        }

        break
      }

      case 'account.application.deauthorized': {
        const application = event.data.object as Stripe.Application
        logger.debug('Processing account.application.deauthorized event', { applicationId: application.id })

        // Validate application object
        if (!application.id || typeof application.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid application ID' },
            { status: 400 }
          )
        }

        // Find and update barber's status
        const { error: updateError } = await supabase
          .from('barbers')
          .update({
            stripe_account_status: 'deauthorized',
            stripe_account_ready: false,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_account_id', application.id)

        if (updateError) {
          logger.error('Error updating barber', updateError)
          return NextResponse.json(
            { error: 'Failed to update barber' },
            { status: 500 }
          )
        }

        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        logger.debug('Processing checkout.session.completed event', { sessionId: session.id })

        // Validate session object
        if (!session.id || typeof session.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid session ID' },
            { status: 400 }
          )
        }

        if (!session.metadata?.bookingId) {
          logger.error('No booking ID found in session metadata')
          return NextResponse.json(
            { error: 'No booking ID found' },
            { status: 400 }
          )
        }

        await updateBookingStatus(
          session.metadata.bookingId,
          'confirmed',
          'succeeded',
          session.payment_intent as string
        )

        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        logger.debug('Processing checkout.session.expired event', { sessionId: session.id })

        // Validate session object
        if (!session.id || typeof session.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid session ID' },
            { status: 400 }
          )
        }

        if (!session.metadata?.bookingId) {
          logger.error('No booking ID found in session metadata')
          return NextResponse.json(
            { error: 'No booking ID found' },
            { status: 400 }
          )
        }

        await updateBookingStatus(
          session.metadata.bookingId,
          'expired',
          'failed'
        )
        break
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        logger.debug('Processing payment_intent.succeeded event', { paymentIntentId: paymentIntent.id })

        // Validate payment intent object
        if (!paymentIntent.id || typeof paymentIntent.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid payment intent ID' },
            { status: 400 }
          )
        }

        // Check if a booking already exists for this payment intent
        const { data: existingBooking, error: findError } = await supabase
          .from('bookings')
          .select('id')
          .eq('payment_intent_id', paymentIntent.id)
          .single()

        let bookingId: string | null = null

        if (!existingBooking) {
          // Create the booking using metadata
          const meta = paymentIntent.metadata || {}
          const { barberId, serviceId, date, notes, guestName, guestEmail, guestPhone, clientId, addonIds, addonTotal, addonsPaidSeparately } = meta
          
          // Debug logging
          logger.debug('Payment intent metadata', { meta })
          logger.debug('Extracted values', { barberId, serviceId, date, notes, guestName, guestEmail, guestPhone, clientId })
          
          if (!barberId || !serviceId || !date) {
            logger.error('Missing required booking metadata in payment intent')
            return NextResponse.json(
              { error: 'Missing required booking metadata' },
              { status: 400 }
            )
          }

          // (Optional) Look up the service price (stored in dollars)
          let price = 0
          // Convert Stripe cents to dollars for bookings table (which stores NUMERIC dollars)
          const platform_fee_cents = paymentIntent.application_fee_amount || 0
          const platform_fee = platform_fee_cents / 100
          const barber_payout_cents = paymentIntent.amount - platform_fee_cents
          const barber_payout = barber_payout_cents / 100
          const { data: service } = await supabase
            .from('services')
            .select('price')
            .eq('id', serviceId)
            .single()
          if (service && service.price) {
            price = Number(service.price)
          }

          // Calculate add-on total from add-ons table using addonIds (deduplicate first)
          let addon_total = 0
          let addonIdArray: string[] = []
          if (addonIds && typeof addonIds === 'string' && addonIds.length > 0) {
            // Deduplicate addon IDs to prevent double-counting
            addonIdArray = [...new Set(addonIds.split(',').filter(id => id.trim()))]
            if (addonIdArray.length > 0) {
              const { data: addons } = await supabase
                .from('service_addons')
                .select('price')
                .in('id', addonIdArray)
                .eq('is_active', true)
              if (addons && addons.length > 0) {
                addon_total = addons.reduce((sum, addon) => sum + Number(addon.price), 0)
              }
            }
          }

          const { data: newBooking, error: createError } = await supabase.from('bookings').insert({
            barber_id: barberId,
            service_id: serviceId,
            date,
            status: 'confirmed',
            payment_status: 'succeeded',
            payment_intent_id: paymentIntent.id,
            price,        // base service price only
            addon_total: 0,  // Let the trigger calculate this from booking_addons
            platform_fee, // dollars
            barber_payout, // dollars
            notes: notes || null,
            guest_name: guestName || null,
            guest_email: guestEmail || null,
            guest_phone: guestPhone || null,
            client_id: clientId === 'guest' ? null : clientId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).select('*, barber:barber_id(*), service:service_id(*), client:client_id(*)').single()

          // Debug logging for the insert operation
          logger.debug('Inserting booking with client_id', { clientId: clientId === 'guest' ? null : clientId })
          logger.debug('Original clientId from metadata', { clientId })
          logger.debug('Condition check result', { isGuest: clientId === 'guest' })

          if (createError) {
            logger.error('Error creating booking after payment', createError)
            return NextResponse.json(
              { error: 'Error creating booking after payment' },
              { status: 500 }
            )
          }

          bookingId = newBooking.id
          logger.debug('Booking created after payment for payment_intent', { paymentIntentId: paymentIntent.id })

          // Send SMS notifications to both barber and client
          try {
            logger.debug('Sending SMS notifications for Stripe booking', { bookingId: newBooking.id })
            const smsResults = await sendBookingConfirmationSMS(newBooking)
            logger.debug('SMS notification results', { smsResults })
          } catch (smsError) {
            logger.error('Failed to send SMS notifications', smsError)
            // Don't fail the booking creation if SMS fails
          }

          // Log successful booking creation for mobile payments
          logger.debug('Mobile payment booking created successfully', {
            bookingId: newBooking.id,
            paymentIntentId: paymentIntent.id,
            barberId,
            clientId,
            amount: paymentIntent.amount,
            status: newBooking.status
          })

          // Track mobile payment success for analytics
          try {
            await supabase
              .from('payment_events')
              .insert({
                payment_intent_id: paymentIntent.id,
                event_type: 'mobile_payment_success',
                booking_id: newBooking.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                metadata: {
                  source: 'mobile_app',
                  barberId,
                  serviceId,
                  clientId,
                  addonIds: addonIds || []
                },
                created_at: new Date().toISOString()
              })
          } catch (trackingError) {
            logger.error('Error tracking mobile payment event', trackingError)
            // Don't fail the webhook if tracking fails
          }

          // Add add-ons to the booking if any were selected (deduplicate first)
          if (addonIds && addonIds.length > 0) {
            const addonIdArray = [...new Set(addonIds.split(',').filter(id => id.trim()))]
            if (addonIdArray.length > 0) {
              const { data: addons } = await supabase
                .from('service_addons')
                .select('id, price')
                .in('id', addonIdArray)
                .eq('is_active', true)

              if (addons && addons.length > 0) {
                const bookingAddons = addons.map(addon => ({
                  booking_id: newBooking.id,
                  addon_id: addon.id,
                  price: addon.price
                }))

                const { error: addonError } = await supabase
                  .from('booking_addons')
                  .insert(bookingAddons)

                if (addonError) {
                  logger.error('Error adding add-ons to booking', addonError)
                } else {
                  logger.debug(`Added ${addons.length} add-ons to booking`)
                }
              }
            }
          }
        } else if (findError && typeof findError === 'object' && (findError as any).code !== 'PGRST116') {
          // Only log error if it's not the 'no rows' error
          logger.error('Error finding booking', findError)
          return NextResponse.json(
            { error: 'Failed to find booking' },
            { status: 500 }
          )
        } else {
          // Booking already exists, just update status
          bookingId = existingBooking.id
          await updateBookingStatus(
            existingBooking.id,
            'confirmed',
            'succeeded',
            paymentIntent.id
          )
        }

        // Store the successful payment in Supabase with all required fields
        if (bookingId) {
          const { error: paymentError } = await supabase.from('payments').insert({
            payment_intent_id: paymentIntent.id,
            amount: paymentIntent.amount, // Already in cents from Stripe
            currency: paymentIntent.currency,
            status: paymentIntent.status,
            barber_stripe_account_id: paymentIntent.transfer_data?.destination,
            platform_fee: paymentIntent.application_fee_amount || 0,
            barber_payout: paymentIntent.amount - (paymentIntent.application_fee_amount || 0),
            booking_id: bookingId, // ✅ Now properly set
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(), // ✅ Now properly set
          })

          if (paymentError) {
            logger.error('Error storing payment in Supabase', paymentError)
            return NextResponse.json(
              { error: 'Error storing payment' },
              { status: 500 }
            )
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        logger.debug('Processing payment_intent.payment_failed event', { paymentIntentId: paymentIntent.id })

        // Validate payment intent object
        if (!paymentIntent.id || typeof paymentIntent.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid payment intent ID' },
            { status: 400 }
          )
        }

        // Find booking with this payment intent ID
        const { data: booking, error: findError } = await supabase
          .from('bookings')
          .select('id')
          .eq('payment_intent_id', paymentIntent.id)
          .single()

        if (findError) {
          logger.error('Error finding booking', findError)
          return NextResponse.json(
            { error: 'Failed to find booking' },
            { status: 500 }
          )
        }

        if (!booking) {
          return NextResponse.json(
            { error: 'Booking not found' },
            { status: 404 }
          )
        }

        await updateBookingStatus(
          booking.id,
          'failed',
          'failed',
          paymentIntent.id
        )

        // Handle retry logic if needed
        if (paymentIntent.next_action) {
          logger.debug('Payment requires additional action', { nextAction: paymentIntent.next_action })
          // You might want to notify the user or handle the next action
        }

        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        logger.debug('Processing charge.refunded event', { chargeId: charge.id })

        // Validate charge object
        if (!charge.id || typeof charge.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid charge ID' },
            { status: 400 }
          )
        }

        if (!charge.payment_intent || typeof charge.payment_intent !== 'string') {
          return NextResponse.json(
            { error: 'Invalid payment intent reference' },
            { status: 400 }
          )
        }

        // Find booking with this payment intent ID
        const { data: booking, error: findError } = await supabase
          .from('bookings')
          .select('id')
          .eq('payment_intent_id', charge.payment_intent)
          .single()

        if (findError) {
          logger.error('Error finding booking', findError)
          return NextResponse.json(
            { error: 'Failed to find booking' },
            { status: 500 }
          )
        }

        if (!booking) {
          return NextResponse.json(
            { error: 'Booking not found' },
            { status: 404 }
          )
        }

        const isPartialRefund = charge.amount_refunded < charge.amount
        const refundStatus = isPartialRefund ? 'partially_refunded' : 'refunded'
        
        await updateBookingStatus(
          booking.id,
          refundStatus,
          refundStatus,
          charge.payment_intent as string
        )

        // Create a refund payment record
        const { error: refundError } = await supabase.from('payments').insert({
          payment_intent_id: charge.payment_intent,
          amount: -charge.amount_refunded, // Negative amount for refunds
          currency: charge.currency,
          status: refundStatus,
          barber_stripe_account_id: typeof charge.transfer === 'string' ? charge.transfer : charge.transfer?.destination,
          platform_fee: 0, // No platform fee on refunds
          barber_payout: -charge.amount_refunded, // Negative payout for refunds
          booking_id: booking.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

        if (refundError) {
          logger.error('Error storing refund payment record', refundError)
          // Don't fail the webhook for this, just log the error
        }

        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Error processing webhook', error)
    return NextResponse.json(
      { error: 'Webhook error' },
      { status: 400 }
    )
  }
}