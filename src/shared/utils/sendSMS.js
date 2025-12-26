const nodemailer = require('nodemailer');

// Import logger from TypeScript module
// Next.js supports importing TS modules in JS files
const { logger } = require('../lib/logger');

const CARRIER_GATEWAYS = {
  verizon: 'vtext.com',
  att: 'txt.att.net',
  tmobile: 'tmomail.net',
  sprint: 'messaging.sprintpcs.com',
  boost: 'sms.myboostmobile.com',
  uscellular: 'email.uscc.net',
  cricket: 'sms.cricketwireless.net',
  metro: 'mymetropcs.com',
  googlefi: 'msg.fi.google.com',
  // Add more as needed
};

function getSmsAddress(phone, carrier) {
  const domain = CARRIER_GATEWAYS[carrier.toLowerCase()];
  if (!domain) throw new Error('Unsupported carrier');
  return `${phone.replace(/\D/g, '')}@${domain}`;
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

async function sendSMS({ phoneNumber, carrier, message }) {
  try {
    const to = getSmsAddress(phoneNumber, carrier);
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to,
      subject: '',
      text: message,
    };
    
    logger.debug('Attempting to send SMS', { to, from: process.env.GMAIL_USER });
    await transporter.sendMail(mailOptions);
    logger.debug('SMS sent successfully', { phoneNumber, carrier });
    return { success: true, message: 'SMS sent successfully' };
  } catch (error) {
    logger.error('SMS sending failed', error);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
}

// Enhanced function to send booking confirmation SMS
async function sendBookingConfirmationSMS(bookingData) {
  const { booking, barber, service, client } = bookingData;
  
  logger.debug('Starting SMS confirmation for booking', { bookingId: booking.id });
  logger.debug('Booking data received', {
    bookingId: booking.id,
    barberId: barber?.id,
    clientId: client?.id,
    serviceId: service?.id,
    serviceName: service?.name
  });

  // Get barber's profile data (SMS data and name) from profiles table
  let barberSmsData = null;
  let barberName = null;
  if (barber && barber.user_id) {
    logger.debug('Fetching barber profile data from profiles table');
    try {
      const { supabaseAdmin } = require('../lib/supabase');
      const { data: barberProfile, error } = await supabaseAdmin
        .from('profiles')
        .select('phone, carrier, sms_notifications, first_name, last_name')
        .eq('id', barber.user_id)
        .single();
      
      if (!error && barberProfile) {
        barberSmsData = {
          phone: barberProfile.phone,
          carrier: barberProfile.carrier,
          sms_notifications: barberProfile.sms_notifications
        };
        barberName = `${barberProfile.first_name} ${barberProfile.last_name}`.trim();
        logger.debug('Retrieved barber profile data', { hasSmsData: !!barberSmsData, hasName: !!barberName });
      } else {
        logger.debug('Failed to fetch barber profile data from profiles', { error: error?.message });
      }
    } catch (error) {
      logger.error('Error fetching barber profile data', error);
    }
  }
  
  try {
    const bookingDate = new Date(booking.date);
    const formattedDate = bookingDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const formattedTime = bookingDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    const results = [];

    // Send SMS to client if they have SMS notifications enabled
    logger.debug('Checking client SMS prerequisites', {
      hasClient: !!client,
      hasPhone: !!client?.phone,
      hasCarrier: !!client?.carrier,
      smsEnabled: client?.sms_notifications
    });
    
    if (client && client.phone && client.carrier && client.sms_notifications) {
      logger.debug('Client SMS prerequisites met - sending SMS');
      const barberDisplayName = barberName || 'Your Barber';
      const clientMessage = `🎉 Booking Confirmed!\n\nService: ${service.name}\nDate: ${formattedDate}\nTime: ${formattedTime}\nBarber: ${barberDisplayName}\n\nSee you there!`;
      
      try {
        logger.debug('Attempting to send client SMS', { phone: client.phone, carrier: client.carrier });
        await sendSMS({
          phoneNumber: client.phone,
          carrier: client.carrier,
          message: clientMessage
        });
        results.push({ recipient: 'client', success: true });
        logger.debug('Client SMS sent successfully');
      } catch (error) {
        logger.error('Failed to send client SMS', error);
        results.push({ recipient: 'client', success: false, error: error.message });
      }
    } else {
      logger.debug('Client SMS prerequisites NOT met', {
        hasClient: !!client,
        hasPhone: !!client?.phone,
        hasCarrier: !!client?.carrier,
        smsEnabled: client?.sms_notifications
      });
    }

    // Send SMS to barber if they have SMS notifications enabled
    const barberPhone = barberSmsData?.phone || barber?.phone;
    const barberCarrier = barberSmsData?.carrier || barber?.carrier;
    const barberSmsEnabled = barberSmsData?.sms_notifications || barber?.sms_notifications;
    
    logger.debug('Checking barber SMS prerequisites', {
      hasPhone: !!barberPhone,
      hasCarrier: !!barberCarrier,
      smsEnabled: barberSmsEnabled,
      source: barberSmsData ? 'profiles' : 'barber'
    });
    
    if (barberPhone && barberCarrier && barberSmsEnabled) {
      const clientName = client ? (client.name || client.first_name + ' ' + client.last_name) : (booking.guest_name || 'Guest');
      const barberMessage = `📅 New Booking!\n\nClient: ${clientName}\nService: ${service.name}\nDate: ${formattedDate}\nTime: ${formattedTime}\n\nBooking ID: ${booking.id}`;
      
      try {
        logger.debug('Attempting to send barber SMS', { phone: barberPhone, carrier: barberCarrier });
        await sendSMS({
          phoneNumber: barberPhone,
          carrier: barberCarrier,
          message: barberMessage
        });
        results.push({ recipient: 'barber', success: true });
        logger.debug('Barber SMS sent successfully');
      } catch (error) {
        logger.error('Failed to send barber SMS', error);
        results.push({ recipient: 'barber', success: false, error: error.message });
      }
    }

    logger.debug('SMS confirmation completed', { results });
    return results;
  } catch (error) {
    logger.error('Error in sendBookingConfirmationSMS', error);
    throw error;
  }
}

// Enhanced function to send booking reminder SMS
async function sendBookingReminderSMS(bookingData) {
  const { booking, barber, service, client } = bookingData;
  
  // Get barber's name from profiles table
  let barberName = null;
  if (barber && barber.user_id) {
    try {
      const { supabaseAdmin } = require('../lib/supabase');
      const { data: barberProfile, error } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', barber.user_id)
        .single();
      
      if (!error && barberProfile) {
        barberName = `${barberProfile.first_name} ${barberProfile.last_name}`.trim();
      }
    } catch (error) {
      logger.error('Error fetching barber name for reminder', error);
    }
  }
  
  try {
    const bookingDate = new Date(booking.date);
    const formattedDate = bookingDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const formattedTime = bookingDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    const results = [];

    // Send reminder to client
    if (client && client.phone && client.carrier && client.sms_notifications) {
      const barberDisplayName = barberName || 'Your Barber';
      const clientMessage = `⏰ Appointment Reminder!\n\nYour appointment is in 1 hour:\nService: ${service.name}\nTime: ${formattedTime}\nBarber: ${barberDisplayName}\n\nSee you soon!`;
      
      try {
        await sendSMS({
          phoneNumber: client.phone,
          carrier: client.carrier,
          message: clientMessage
        });
        results.push({ recipient: 'client', success: true });
      } catch (error) {
        logger.error('Failed to send client reminder SMS', error);
        results.push({ recipient: 'client', success: false, error: error.message });
      }
    }

    // Send reminder to barber
    if (barber.phone && barber.carrier && barber.sms_notifications) {
      const clientName = client ? (client.name || client.first_name + ' ' + client.last_name) : (booking.guest_name || 'Guest');
      const barberMessage = `⏰ Appointment Reminder!\n\nYou have an appointment in 1 hour:\nClient: ${clientName}\nService: ${service.name}\nTime: ${formattedTime}`;
      
      try {
        await sendSMS({
          phoneNumber: barber.phone,
          carrier: barber.carrier,
          message: barberMessage
        });
        results.push({ recipient: 'barber', success: true });
      } catch (error) {
        logger.error('Failed to send barber reminder SMS', error);
        results.push({ recipient: 'barber', success: false, error: error.message });
      }
    }

    return results;
  } catch (error) {
    logger.error('Error in sendBookingReminderSMS', error);
    throw error;
  }
}

module.exports = { 
  sendSMS, 
  getSmsAddress, 
  CARRIER_GATEWAYS,
  sendBookingConfirmationSMS,
  sendBookingReminderSMS
}; 