import { sendSMS } from '@/shared/utils/sendSMS';
const { logger } = require('@/shared/lib/logger');

export async function POST(req) {
  try {
    const { phoneNumber, carrier } = await req.json();
    
    logger.debug('Test SMS request', { phoneNumber, carrier });
    
    // Send a test message
    await sendSMS({ 
      phoneNumber, 
      carrier, 
      message: 'Test SMS from Barber App - If you receive this, SMS is working!' 
    });
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Test SMS sent successfully',
      details: {
        phoneNumber,
        carrier,
        gateway: `${phoneNumber.replace(/\D/g, '')}@${getCarrierGateway(carrier)}`
      }
    }), { status: 200 });
  } catch (e) {
    logger.error('Test SMS error', e);
    return new Response(JSON.stringify({ 
      error: e.message,
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    }), { status: 500 });
  }
}

function getCarrierGateway(carrier) {
  const gateways = {
    verizon: 'vtext.com',
    att: 'txt.att.net',
    tmobile: 'tmomail.net',
    sprint: 'messaging.sprintpcs.com',
    boost: 'sms.myboostmobile.com',
    uscellular: 'email.uscc.net',
    cricket: 'sms.cricketwireless.net',
    metro: 'mymetropcs.com',
    googlefi: 'msg.fi.google.com',
  };
  return gateways[carrier.toLowerCase()] || 'unknown';
} 