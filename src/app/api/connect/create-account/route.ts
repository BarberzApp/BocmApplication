import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { handleCorsPreflight, withCors } from '@/shared/lib/cors'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}

const getBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_APP_URL || 'https://bocmstyle.com';
  } else {
    return 'http://localhost:3002';
  }
};

const APP_URL = getBaseUrl();
logger.debug('Using app URL', { url: APP_URL });

// Mobile deep link URLs for redirecting back to the app
const getMobileRedirectUrls = () => {
  // Use web URLs that will redirect to mobile deep links
  const webReturnUrl = `${APP_URL}/barber/connect/return`;
  const webRefreshUrl = `${APP_URL}/barber/connect/refresh`;
  
  return {
    returnUrl: webReturnUrl,
    refreshUrl: webRefreshUrl,
  };
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20' as any,
})

// Type definitions
interface CreateAccountRequest {
  barberId: string
  email: string
}

// Use environment variable for business profile URL
const getBusinessProfileUrl = (barberId: string) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bocmstyle.com';
  return `${appUrl}/barber/${barberId}`;
};

// Helper function to check and update Stripe account status
async function checkAndUpdateStripeAccountStatus(barberId: string, stripeAccountId: string) {
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId)
    
    const { error: updateError } = await supabase
      .from('barbers')
      .update({
        stripe_account_status: account.charges_enabled ? 'active' : 'pending',
        stripe_account_ready: account.charges_enabled && account.details_submitted,
        updated_at: new Date().toISOString(),
      })
      .eq('id', barberId)

    if (updateError) {
      logger.error('Error updating account status', updateError)
      return false
    }

    return true
  } catch (error) {
    logger.error('Error checking Stripe account status', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Handle CORS preflight
    const preflightResponse = handleCorsPreflight(request);
    if (preflightResponse) return preflightResponse;

    const body = await request.json() as CreateAccountRequest
    const { barberId, email } = body

    // Input validation
    if (!barberId || typeof barberId !== 'string') {
      const response = NextResponse.json(
        { error: 'Barber ID is required and must be a string' },
        { status: 400 }
      )
      return withCors(request, response)
    }

    if (barberId.trim().length === 0) {
      const response = NextResponse.json(
        { error: 'Barber ID cannot be empty' },
        { status: 400 }
      )
      return withCors(request, response)
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      const response = NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      )
      return withCors(request, response)
    }

    // Get barber details
    const { data: barber, error: barberError } = await supabase
      .from('barbers')
      .select('*')
      .eq('id', barberId)
      .single()

    if (barberError) {
      logger.error('Error fetching barber', barberError)
      const response = NextResponse.json(
        { error: 'Failed to fetch barber details' },
        { status: 500 }
      )
      return withCors(request, response)
    }

    if (!barber) {
      const response = NextResponse.json(
        { error: 'Barber not found' },
        { status: 404 }
      )
      return withCors(request, response)
    }

    // Check if barber already has a Stripe account in database
    if (barber.stripe_account_id) {
      // Check if the existing account is still valid
      try {
        const existingAccount = await stripe.accounts.retrieve(barber.stripe_account_id)
        logger.debug('Found existing Stripe account', { accountId: existingAccount.id })
        
        // Update the account status based on current Stripe status
        await checkAndUpdateStripeAccountStatus(barberId, existingAccount.id)

        // Create a new account link for the existing account
        const accountLink = await stripe.accountLinks.create({
          account: existingAccount.id,
          refresh_url: getMobileRedirectUrls().refreshUrl,
          return_url: getMobileRedirectUrls().returnUrl,
          type: 'account_onboarding',
        })

        const response = NextResponse.json({
          url: accountLink.url,
          accountId: existingAccount.id,
          existing: true,
        })
        return withCors(request, response)
      } catch (stripeError) {
        logger.debug('Existing account not found or invalid, will create new one')
        // Continue to create new account
      }
    }

    // Check for existing Stripe accounts with this email
    try {
      const existingAccounts = await stripe.accounts.list({
        limit: 10,
      })

      const matchingAccount = existingAccounts.data.find(account => 
        account.email === email && account.type === 'express'
      )

      if (matchingAccount) {
        logger.debug('Found existing Stripe account with email', { accountId: matchingAccount.id })
        
        // Update barber record with existing Stripe account ID
        logger.debug('Updating barber record with existing Stripe account ID', { accountId: matchingAccount.id });
        const { error: updateError } = await supabase
          .from('barbers')
          .update({
            stripe_account_id: matchingAccount.id,
            stripe_account_status: 'active',
            stripe_account_ready: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', barberId)

        if (updateError) {
          logger.error('Error updating barber with existing account', updateError)
          const response = NextResponse.json(
            { error: 'Failed to update barber record with existing account' },
            { status: 500 }
          )
          return withCors(request, response)
        }

        logger.debug('Successfully updated barber record with existing Stripe account ID');

        // Verify the update was successful
        const { data: verifyBarber, error: verifyError } = await supabase
          .from('barbers')
          .select('stripe_account_id, stripe_account_status, stripe_account_ready')
          .eq('id', barberId)
          .single();

        if (verifyError) {
          logger.error('Error verifying barber update', verifyError);
        } else {
          logger.debug('Verified barber record after update', { verifyBarber });
        }

        // Update the account status based on current Stripe status
        await checkAndUpdateStripeAccountStatus(barberId, matchingAccount.id)

        // Create an account link for the existing account
        const accountLink = await stripe.accountLinks.create({
          account: matchingAccount.id,
          refresh_url: `${APP_URL}/barber/connect/refresh`,
          return_url: `${APP_URL}/barber/connect/return`,
          type: 'account_onboarding',
        })

        const response = NextResponse.json({
          url: accountLink.url,
          accountId: matchingAccount.id,
          existing: true,
        })
        return withCors(request, response)
      }
    } catch (searchError) {
      logger.debug('Error searching for existing accounts, will create new one', { error: searchError })
      // Continue to create new account
    }

    // Always use the production URL for business_profile.url
    const businessProfileUrl = getBusinessProfileUrl(barber.id);
    logger.debug('Business profile URL', { url: businessProfileUrl })

    // Create a Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      business_profile: {
        url: businessProfileUrl
      },
      metadata: {
        barber_id: barberId,
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    })

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: getMobileRedirectUrls().refreshUrl,
      return_url: getMobileRedirectUrls().returnUrl,
      type: 'account_onboarding',
    })

    // Update barber record with Stripe account ID
    logger.debug('Saving Stripe account ID to database', { accountId: account.id, barberId });
    
    const { error: updateError } = await supabase
      .from('barbers')
      .update({
        stripe_account_id: account.id,
        stripe_account_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', barberId)

    if (updateError) {
      logger.error('Error updating barber', updateError)
      // Attempt to delete the Stripe account since we couldn't save the ID
      await stripe.accounts.del(account.id)
      const response = NextResponse.json(
        { error: 'Failed to update barber record' },
        { status: 500 }
      )
      return withCors(request, response)
    }

    logger.debug('Successfully saved Stripe account ID to database');

    const response = NextResponse.json({
      url: accountLink.url,
      accountId: account.id,
    })
    return withCors(request, response)
  } catch (error) {
    logger.error('Error creating Stripe Connect account', error)
    const response = NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create Stripe account' },
      { status: 500 }
    )
    return withCors(request, response)
  }
}