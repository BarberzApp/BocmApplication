import { sendSMS } from '@/shared/utils/sendSMS';
const { logger } = require('@/shared/lib/logger');

export async function POST(req) {
  try {
    const { phoneNumber, carrier, message } = await req.json();
    
    // Validate required fields
    if (!phoneNumber || !carrier || !message) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: phoneNumber, carrier, message' 
      }), { status: 400 });
    }

    // Check environment variables
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      return new Response(JSON.stringify({ 
        error: 'Gmail credentials not configured. Please check GMAIL_USER and GMAIL_PASS environment variables.' 
      }), { status: 500 });
    }

    await sendSMS({ phoneNumber, carrier, message });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    logger.error('SMS sending error', e);
    return new Response(JSON.stringify({ 
      error: e.message,
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    }), { status: 500 });
  }
} 