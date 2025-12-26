require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getUserById(userId) {
  try {
    console.log(`🔍 Looking up user ID: ${userId}`);

    // Check profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, role, created_at')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      return;
    }

    if (!profile) {
      console.log('❌ No profile found for this user ID');
      return;
    }

    console.log('\n👤 Profile Information:');
    console.log('======================');
    console.log(`📧 Email: ${profile.email}`);
    console.log(`👤 Name: ${profile.name}`);
    console.log(`🔑 Role: ${profile.role}`);
    console.log(`🆔 User ID: ${profile.id}`);
    console.log(`📅 Created: ${new Date(profile.created_at).toLocaleDateString()}`);

    // Check bookings for this user
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, date, payment_status, barber_id, service_id')
      .eq('client_id', userId)
      .order('date', { ascending: false })
      .limit(10);

    if (bookingsError) {
      console.error('❌ Error fetching bookings:', bookingsError);
    } else {
      console.log('\n📅 Recent Bookings:');
      console.log('==================');
      if (bookings && bookings.length > 0) {
        bookings.forEach((booking, index) => {
          console.log(`\n${index + 1}. Booking ID: ${booking.id}`);
          console.log(`   Date: ${new Date(booking.date).toLocaleString()}`);
          console.log(`   Payment Status: ${booking.payment_status || 'null'}`);
        });
      } else {
        console.log('No bookings found');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Get user ID from command line
const userId = process.argv[2];

if (!userId) {
  console.log('Usage: node get-user-by-id.js <user-id>');
  console.log('Example: node get-user-by-id.js dcf82b66-d265-4b4b-a909-e5b490ca17a6');
  process.exit(1);
}

getUserById(userId);

