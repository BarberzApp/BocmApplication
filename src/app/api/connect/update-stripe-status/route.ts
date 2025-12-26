import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/shared/lib/supabase';
import { logger } from '@/shared/lib/logger';
import { handleCorsPreflight, withCors } from '@/shared/lib/cors';

interface UpdateStatusRequest {
  barberId: string;
  accountId: string;
}

export async function POST(request: NextRequest) {
  try {
    // Handle CORS preflight
    const preflightResponse = handleCorsPreflight(request);
    if (preflightResponse) return preflightResponse;

    const body = await request.json() as UpdateStatusRequest;
    const { barberId, accountId } = body;

    // Input validation
    if (!barberId || !accountId) {
      const response = NextResponse.json(
        { error: 'Barber ID and Account ID are required' },
        { status: 400 }
      )
      return withCors(request, response)
    }

    // Update the barber's Stripe account status
    const { error: updateError } = await supabase
      .from('barbers')
      .update({
        stripe_account_id: accountId,
        stripe_account_status: 'active',
        stripe_account_ready: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', barberId);

    if (updateError) {
      logger.error('Error updating barber', updateError);
      const response = NextResponse.json(
        { error: 'Failed to update barber status' },
        { status: 500 }
      )
      return withCors(request, response)
    }

    const response = NextResponse.json({
      success: true,
      message: 'Stripe account status updated successfully',
      barberId,
      accountId,
    })
    return withCors(request, response)
  } catch (error) {
    logger.error('Error updating Stripe status', error);
    const response = NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update Stripe status' },
      { status: 500 }
    )
    return withCors(request, response)
  }
}
