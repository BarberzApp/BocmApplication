require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkBookingByPaymentIntent(paymentIntentId) {
  try {
    console.log(`🔍 Looking up booking for payment intent: ${paymentIntentId}`);

    // Check bookings table
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('payment_intent_id', paymentIntentId)
      .single();

    if (bookingError && bookingError.code !== 'PGRST116') {
      console.error('❌ Error fetching booking:', bookingError);
    } else if (booking) {
      console.log('\n📅 Booking Found:');
      console.log('================');
      console.log(`🆔 Booking ID: ${booking.id}`);
      console.log(`👤 Client ID: ${booking.client_id || 'null (guest)'}`);
      console.log(`💇 Barber ID: ${booking.barber_id}`);
      console.log(`📅 Date: ${new Date(booking.date).toLocaleString()}`);
      console.log(`💰 Price: $${(booking.price / 100).toFixed(2)}`);
      console.log(`💳 Payment Status: ${booking.payment_status || 'null'}`);
      console.log(`📊 Status: ${booking.status || 'null'}`);
      console.log(`🆔 Payment Intent ID: ${booking.payment_intent_id}`);
    } else {
      console.log('\n❌ No booking found for this payment intent');
      console.log('This could mean:');
      console.log('  1. The webhook has not fired yet');
      console.log('  2. The webhook failed to create the booking');
      console.log('  3. The payment intent ID is incorrect');
      
      // Check all recent bookings to see if any match
      console.log('\n🔍 Checking recent bookings...');
      const { data: recentBookings } = await supabase
        .from('bookings')
        .select('id, payment_intent_id, client_id, date, payment_status')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (recentBookings && recentBookings.length > 0) {
        console.log(`\nFound ${recentBookings.length} recent bookings:`);
        recentBookings.forEach((b, i) => {
          console.log(`  ${i + 1}. Booking ${b.id} - Payment Intent: ${b.payment_intent_id?.substring(0, 20)}... - Client: ${b.client_id || 'guest'} - Status: ${b.payment_status}`);
        });
      }
    }

    // Also check by client ID from the original booking request
    const clientId = 'dcf82b66-d265-4b4b-a909-e5b490ca17a6';
    console.log(`\n🔍 Checking all bookings for client: ${clientId}`);
    const { data: clientBookings, error: clientError } = await supabase
      .from('bookings')
      .select('id, payment_intent_id, date, payment_status, status')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (clientError) {
      console.error('❌ Error fetching client bookings:', clientError);
    } else if (clientBookings && clientBookings.length > 0) {
      console.log(`\n✅ Found ${clientBookings.length} bookings for this client:`);
      clientBookings.forEach((b, i) => {
        console.log(`  ${i + 1}. Booking ${b.id}`);
        console.log(`     Payment Intent: ${b.payment_intent_id || 'null'}`);
        console.log(`     Date: ${new Date(b.date).toLocaleString()}`);
        console.log(`     Payment Status: ${b.payment_status || 'null'}`);
        console.log(`     Status: ${b.status || 'null'}`);
      });
    } else {
      console.log('❌ No bookings found for this client');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Get payment intent ID from command line
const paymentIntentId = process.argv[2];

if (!paymentIntentId) {
  console.log('Usage: node check-booking-by-payment-intent.js <payment-intent-id>');
  console.log('Example: node check-booking-by-payment-intent.js pi_3SfW6CE7kvTS9PZe1kXhACIw');
  process.exit(1);
}

checkBookingByPaymentIntent(paymentIntentId);

