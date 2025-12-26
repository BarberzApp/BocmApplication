require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const stripe = new Stripe(stripeSecretKey);

async function manuallyCreateBooking(paymentIntentId) {
  try {
    console.log(`🔍 Fetching payment intent: ${paymentIntentId}`);
    
    // Fetch the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    console.log('\n💳 Payment Intent Details:');
    console.log('==========================');
    console.log(`Status: ${paymentIntent.status}`);
    console.log(`Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);
    console.log(`Metadata:`, paymentIntent.metadata);
    
    if (paymentIntent.status !== 'succeeded') {
      console.log(`\n❌ Payment intent status is "${paymentIntent.status}", not "succeeded"`);
      console.log('Cannot create booking for non-succeeded payment');
      return;
    }
    
    // Check if booking already exists
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('payment_intent_id', paymentIntentId)
      .single();
    
    if (existingBooking) {
      console.log(`\n✅ Booking already exists: ${existingBooking.id}`);
      return;
    }
    
    // Extract metadata
    const meta = paymentIntent.metadata || {};
    const { barberId, serviceId, date, notes, guestName, guestEmail, guestPhone, clientId, addonIds, servicePrice, addonTotal } = meta;
    
    console.log('\n📋 Booking Details from Metadata:');
    console.log('==================================');
    console.log(`Barber ID: ${barberId}`);
    console.log(`Service ID: ${serviceId}`);
    console.log(`Date: ${date}`);
    console.log(`Client ID: ${clientId || 'null (guest)'}`);
    console.log(`Service Price: ${servicePrice || 'null'}`);
    console.log(`Addon Total: ${addonTotal || 'null'}`);
    
    if (!barberId || !serviceId || !date) {
      console.log('\n❌ Missing required metadata');
      return;
    }
    
    // Get service details
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('name, price, duration')
      .eq('id', serviceId)
      .single();
    
    if (serviceError || !service) {
      console.log('\n❌ Service not found:', serviceError);
      return;
    }
    
    // Calculate prices
    const servicePriceCents = parseInt(servicePrice || '0');
    const addonTotalCents = parseInt(addonTotal || '0');
    const platformFeeCents = paymentIntent.application_fee_amount || 0;
    const barberPayoutCents = paymentIntent.amount - platformFeeCents;
    
    // Convert to dollars for database
    const price = (servicePriceCents + addonTotalCents) / 100;
    const platformFee = platformFeeCents / 100;
    const barberPayout = barberPayoutCents / 100;
    
    console.log('\n💰 Price Breakdown:');
    console.log('===================');
    console.log(`Service Price: $${(servicePriceCents / 100).toFixed(2)}`);
    console.log(`Addon Total: $${(addonTotalCents / 100).toFixed(2)}`);
    console.log(`Platform Fee: $${platformFee.toFixed(2)}`);
    console.log(`Barber Payout: $${barberPayout.toFixed(2)}`);
    console.log(`Total Price: $${price.toFixed(2)}`);
    
    // Calculate end time manually to avoid trigger issues
    const startDate = new Date(date);
    const durationMinutes = parseInt(service.duration) || 30;
    const endTime = new Date(startDate.getTime() + durationMinutes * 60000).toISOString();
    
    // Create booking
    console.log('\n📝 Creating booking...');
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        barber_id: barberId,
        service_id: serviceId,
        date: date,
        end_time: endTime,
        price: price,
        status: 'confirmed',
        payment_status: 'succeeded',
        payment_intent_id: paymentIntentId,
        platform_fee: platformFee,
        barber_payout: barberPayout,
        notes: notes || null,
        client_id: clientId && clientId !== 'guest' ? clientId : null,
        guest_name: guestName || null,
        guest_email: guestEmail || null,
        guest_phone: guestPhone || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    
    if (bookingError) {
      console.log('\n❌ Error creating booking:', bookingError);
      return;
    }
    
    console.log('\n✅ Booking created successfully!');
    console.log('================================');
    console.log(`Booking ID: ${booking.id}`);
    console.log(`Client ID: ${booking.client_id || 'null (guest)'}`);
    console.log(`Date: ${new Date(booking.date).toLocaleString()}`);
    console.log(`Status: ${booking.status}`);
    console.log(`Payment Status: ${booking.payment_status}`);
    
    // Create booking addons if any
    if (addonIds && addonIds.length > 0) {
      const addonIdArray = addonIds.split(',').filter(id => id.trim());
      console.log(`\n📦 Creating ${addonIdArray.length} addon records...`);
      
      for (const addonId of addonIdArray) {
        const { data: addon, error: addonError } = await supabase
          .from('service_addons')
          .select('id, price')
          .eq('id', addonId.trim())
          .single();
        
        if (!addonError && addon) {
          const { error: bookingAddonError } = await supabase
            .from('booking_addons')
            .insert({
              booking_id: booking.id,
              addon_id: addonId.trim(),
              price: addon.price,
            });
          
          if (bookingAddonError) {
            console.log(`  ⚠️  Error creating addon ${addonId}:`, bookingAddonError.message);
          } else {
            console.log(`  ✅ Created addon ${addonId}`);
          }
        }
      }
    }
    
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Get payment intent ID from command line
const paymentIntentId = process.argv[2];

if (!paymentIntentId) {
  console.log('Usage: node manually-create-booking-from-payment.js <payment-intent-id>');
  console.log('Example: node manually-create-booking-from-payment.js pi_3SfW6CE7kvTS9PZe1kXhACIw');
  process.exit(1);
}

manuallyCreateBooking(paymentIntentId);

