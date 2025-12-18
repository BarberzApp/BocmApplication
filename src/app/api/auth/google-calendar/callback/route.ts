import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { logger } from '@/shared/lib/logger';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.NODE_ENV === 'development' 
    ? 'https://3d6b1eb7b7c8.ngrok-free.app/api/auth/google-calendar/callback'
    : process.env.GOOGLE_REDIRECT_URI
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state'); // Extract state parameter

    if (error) {
      logger.error('OAuth error', { error });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=oauth_failed&message=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=no_code`
      );
    }

    // Get tokens from Google
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=no_token`
      );
    }

    // Get current user with session recovery
    const supabase = createRouteHandlerClient({ cookies });
    
    // First try to get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    logger.debug('OAuth Callback - Session check', { 
      hasSession: !!session, 
      hasError: !!sessionError 
    });
    
    let user: any = session?.user || null;
    let userError = sessionError;
    
    // If no session, try to refresh it
    if (!session && !sessionError) {
      logger.debug('OAuth Callback - No session found, attempting refresh');
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        logger.error('OAuth Callback - Session refresh failed', refreshError);
      } else if (refreshedSession) {
        logger.debug('OAuth Callback - Session refreshed successfully');
        user = refreshedSession.user;
      }
    }
    
    // If still no user, try to get user directly
    if (!user) {
      const { data: { user: directUser }, error: directUserError } = await supabase.auth.getUser();
      user = directUser;
      userError = directUserError;
    }
    
    // If still no user, try to recover from state parameter
    if (!user && state) {
      logger.debug('OAuth Callback - Attempting session recovery from state parameter', { state });
      
      // Try to get user by ID from state parameter
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('id', state)
        .single();
      
      if (profile && !profileError) {
        logger.debug('OAuth Callback - Found user from state parameter', { userId: profile.id });
        // Create a minimal user object for the callback
        user = { id: profile.id, email: profile.email } as any;
        userError = null;
      } else {
        logger.error('OAuth Callback - Could not recover user from state parameter', profileError);
      }
    }
    
    logger.debug('OAuth Callback - Final user check', { 
      hasUser: !!user, 
      userId: user?.id, 
      hasError: !!userError 
    });
    
    if (userError || !user) {
      logger.error('OAuth Callback - Authentication failed', userError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/login?error=not_authenticated&message=${encodeURIComponent('Session expired during OAuth flow. Please log in again.')}`
      );
    }

    // Save connection to database using service role to bypass RLS
    logger.debug('OAuth Callback - Saving calendar connection for user', { userId: user.id });
    
    // Import the admin client
    const { supabaseAdmin } = await import('@/shared/lib/supabase');
    
    logger.debug('OAuth Callback - Using service role for database operations');
    
    const { data: connection, error: connectionError } = await supabaseAdmin
      .from('user_calendar_connections')
      .upsert({
        user_id: user.id,
        provider: 'google_calendar',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        calendar_id: 'primary',
        sync_enabled: true,
        sync_direction: 'bidirectional',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,provider' })
      .select()
      .single();

    if (connectionError) {
      logger.error('OAuth Callback - Database save failed', connectionError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=save_failed&message=${encodeURIComponent(connectionError.message)}`
      );
    }
    
    logger.debug('OAuth Callback - Calendar connection saved successfully', { connectionId: connection.id });

    // Log successful connection using service role
    await supabaseAdmin
      .from('calendar_sync_logs')
      .insert({
        user_id: user.id,
        connection_id: connection.id,
        operation: 'connect',
        status: 'success',
        details: { provider: 'google_calendar' }
      });

    // Redirect back to settings with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=calendar_connected`
    );

  } catch (error) {
    logger.error('Error in Google Calendar OAuth callback', error);
    
    // Provide more specific error information
    let errorMessage = 'callback_failed';
    if (error instanceof Error) {
      if (error.message.includes('403')) {
        errorMessage = 'access_denied';
      } else if (error.message.includes('401')) {
        errorMessage = 'not_authenticated';
      } else if (error.message.includes('database')) {
        errorMessage = 'database_error';
      }
    }
    
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=${errorMessage}&message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`
    );
  }
} 