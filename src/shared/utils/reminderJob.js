const { sendBookingReminderSMS } = require('./sendSMS');
const { supabaseAdmin } = require('../lib/supabase');
const { logger } = require('../lib/logger');

async function checkReminders() {
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

  logger.debug('Checking for bookings between', { start: now.toISOString(), end: inOneHour.toISOString() });

  // Get bookings that are confirmed and within the next hour
  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select(`
      *,
      barber:barber_id(*),
      service:service_id(*),
      client:client_id(*)
    `)
    .eq('status', 'confirmed')
    .gte('date', now.toISOString())
    .lte('date', inOneHour.toISOString());

  if (error) {
    logger.error('Error fetching bookings for reminders', error);
    throw error;
  }

  logger.debug('Found bookings that need reminders', { count: bookings?.length || 0 });

  for (const booking of bookings || []) {
    try {
      logger.debug('Processing reminder for booking', { bookingId: booking.id });
      
      // Send reminder SMS to both client and barber
      const smsResults = await sendBookingReminderSMS(booking);
      logger.debug('Reminder SMS results for booking', { bookingId: booking.id, results: smsResults });

      // Optionally, you could mark that reminders were sent in the database
      // This would require adding a reminder_sent field to the bookings table
      
    } catch (error) {
      logger.error(`Failed to send reminder for booking ${booking.id}`, error);
    }
  }
  
  logger.debug('Reminder check completed', { timestamp: now.toISOString() });
}

module.exports = { checkReminders }; 