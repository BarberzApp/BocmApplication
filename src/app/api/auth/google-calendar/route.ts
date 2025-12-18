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
    // Check if user is authenticated first
    const supabase = createRouteHandlerClient({ cookies });
    
    // First try to get session from cookies
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    let user: any = session?.user || null;
    let userError = sessionError;
    
    // If no session from cookies, try to get user directly
    if (!user) {
      const { data: { user: directUser }, error: directUserError } = await supabase.auth.getUser();
      user = directUser;
      userError = directUserError;
    }
    
    // If still no user, check if we have an authorization header (for client-side calls)
    if (!user) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        logger.debug('Calendar OAuth - Using Bearer token for authentication');
        
        // Create a new Supabase client with the token
        const { createClient } = await import('@supabase/supabase-js');
        const tokenClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          }
        );
        
        const { data: { user: tokenUser }, error: tokenError } = await tokenClient.auth.getUser();
        user = tokenUser;
        userError = tokenError;
      }
    }
    
    if (userError || !user) {
      logger.error('Calendar OAuth - User not authenticated', userError);
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }
    
    logger.debug('Calendar OAuth - User authenticated', { userId: user.id });
    
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      prompt: 'consent',
      include_granted_scopes: true,
      state: user.id // Pass user ID in state for session recovery
    });

    return NextResponse.json({ url });
  } catch (error) {
    logger.error('Error generating auth URL', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    
    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    // Get tokens from Google
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      return NextResponse.json(
        { error: 'Failed to get access token' },
        { status: 400 }
      );
    }

    // Get current user
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Save connection to database
    const { data: connection, error: connectionError } = await supabase
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
      logger.error('Error saving calendar connection', connectionError);
      return NextResponse.json(
        { error: 'Failed to save calendar connection' },
        { status: 500 }
      );
    }

    // Log successful connection
    await supabase
      .from('calendar_sync_logs')
      .insert({
        user_id: user.id,
        connection_id: connection.id,
        operation: 'connect',
        status: 'success',
        details: { provider: 'google_calendar' }
      });

    return NextResponse.json({ 
      success: true, 
      message: 'Google Calendar connected successfully',
      connection: {
        id: connection.id,
        provider: connection.provider,
        sync_enabled: connection.sync_enabled,
        sync_direction: connection.sync_direction
      }
    });

  } catch (error) {
    logger.error('Error in Google Calendar OAuth callback', error);
    return NextResponse.json(
      { error: 'Failed to complete authentication' },
      { status: 500 }
    );
  }
} 