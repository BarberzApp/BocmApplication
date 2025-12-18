require('dotenv').config();
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function processWebhookManually(eventId) {
  try {
    console.log(`🔍 Retrieving webhook event: ${eventId}`);
    
    // Retrieve the event from Stripe
    const event = await stripe.events.retrieve(eventId);
    
    console.log('✅ Event retrieved:', {
      id: event.id,
      type: event.type,
      created: new Date(event.created * 1000).toLocaleString()
    });
    
    if (event.type !== 'payment_intent.succeeded') {
      console.log(`⚠️  Event type is ${event.type}, not payment_intent.succeeded`);
      return;
    }
    
    const paymentIntent = event.data.object;
    console.log('\n💳 Payment Intent:', {
      id: paymentIntent.id,
      amount: `$${(paymentIntent.amount / 100).toFixed(2)}`,
      status: paymentIntent.status,
      metadata: paymentIntent.metadata
    });
    
    // Check if booking already exists
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('payment_intent_id', paymentIntent.id)
      .single();
    
    if (existingBooking) {
      console.log(`\n✅ Booking already exists: ${existingBooking.id}`);
      return;
    }
    
    // Extract metadata
    const meta = paymentIntent.metadata || {};
    const { barberId, serviceId, date, notes, guestName, guestEmail, guestPhone, clientId, addonIds } = meta;
    
    console.log('\n📋 Booking Metadata:', {
      barberId,
      serviceId,
      date,
      clientId: clientId || 'null (guest)',
      guestName: guestName || 'null',
      guestEmail: guestEmail || 'null',
      guestPhone: guestPhone || 'null'
    });
    
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
    const servicePriceCents = parseInt(meta.servicePrice || '0');
    const addonTotalCents = parseInt(meta.addonTotal || '0');
    const platformFeeCents = paymentIntent.application_fee_amount || 0;
    const barberPayoutCents = paymentIntent.amount - platformFeeCents;
    
    const platformFee = platformFeeCents / 100;
    const barberPayout = barberPayoutCents / 100;
    // Price must equal platform_fee + barber_payout to satisfy check_payment_amounts constraint
    const price = platformFee + barberPayout;
    
    console.log('\n💰 Price Breakdown:');
    console.log(`  Service Price: $${(servicePriceCents / 100).toFixed(2)} (paid directly to barber at appointment)`);
    console.log(`  Addon Total: $${(addonTotalCents / 100).toFixed(2)}`);
    console.log(`  Platform Fee: $${platformFee.toFixed(2)}`);
    console.log(`  Barber Payout: $${barberPayout.toFixed(2)}`);
    console.log(`  Total Charged (price): $${price.toFixed(2)} (platform_fee + barber_payout)`);
    
    // Create booking (end_time will be calculated by database trigger)
    console.log('\n📝 Creating booking...');
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        barber_id: barberId,
        service_id: serviceId,
        date: date,
        price: price,
        status: 'confirmed',
        payment_status: 'succeeded',
        payment_intent_id: paymentIntent.id,
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
      if (bookingError.message.includes('invalid input syntax for type interval')) {
        console.log('\n⚠️  Database trigger error - trying with explicit end_time...');
        // Try with explicit end_time
        const startDate = new Date(date);
        const durationMinutes = parseInt(service.duration) || 30;
        const endTime = new Date(startDate.getTime() + durationMinutes * 60000).toISOString();
        
        const { data: booking2, error: bookingError2 } = await supabase
          .from('bookings')
          .insert({
            barber_id: barberId,
            service_id: serviceId,
            date: date,
            end_time: endTime,
            price: price,
            status: 'confirmed',
            payment_status: 'succeeded',
            payment_intent_id: paymentIntent.id,
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
        
        if (bookingError2) {
          console.log('❌ Still failed with explicit end_time:', bookingError2);
        } else {
          console.log('✅ Booking created successfully with explicit end_time!');
          console.log(`   Booking ID: ${booking2.id}`);
        }
      }
      return;
    }
    
    console.log('\n✅ Booking created successfully!');
    console.log(`   Booking ID: ${booking.id}`);
    console.log(`   Client ID: ${booking.client_id || 'null (guest)'}`);
    console.log(`   Date: ${new Date(booking.date).toLocaleString()}`);
    console.log(`   Status: ${booking.status}`);
    console.log(`   Payment Status: ${booking.payment_status}`);
    
    // Create booking addons if any
    if (addonIds && addonIds.length > 0 && addonIds !== '') {
      const addonIdArray = addonIds.split(',').filter(id => id.trim());
      console.log(`\n📦 Creating ${addonIdArray.length} addon records...`);
      
      for (const addonId of addonIdArray) {
        const { data: addon } = await supabase
          .from('service_addons')
          .select('id, price')
          .eq('id', addonId.trim())
          .single();
        
        if (addon) {
          await supabase
            .from('booking_addons')
            .insert({
              booking_id: booking.id,
              addon_id: addonId.trim(),
              price: addon.price,
            });
          console.log(`  ✅ Created addon ${addonId}`);
        }
      }
    }
    
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Get event ID from command line
const eventId = process.argv[2] || 'evt_3SfW6CE7kvTS9PZe1xi4d78y';

processWebhookManually(eventId);

