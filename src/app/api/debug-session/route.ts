import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { logger } from '@/shared/lib/logger';

export async function GET(request: NextRequest) {
  try {
    logger.debug('Debug session endpoint called');
    
    // Get all cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    // Filter for session-related cookies
    const sessionCookies = allCookies.filter(cookie => 
      cookie.name.includes('session') || 
      cookie.name.includes('auth') || 
      cookie.name.includes('supabase') ||
      cookie.name.startsWith('sb-')
    );
    
    logger.debug('All cookies found', { count: allCookies.length, names: allCookies.map(c => c.name) });
    logger.debug('Session cookies found', { count: sessionCookies.length, names: sessionCookies.map(c => c.name) });
    
    // Try to get session using Supabase
    const supabase = createRouteHandlerClient({ cookies });
    
    // First try getSession
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    let user: any = session?.user || null;
    let userError = sessionError;
    
    logger.debug('Session check', { 
      hasSession: !!session, 
      hasError: !!sessionError,
      userId: session?.user?.id 
    });
    
    // If no session from cookies, try to get user directly
    if (!user) {
      const { data: { user: directUser }, error: directUserError } = await supabase.auth.getUser();
      user = directUser;
      userError = directUserError;
    }
    
    // If still no user, check if we have an authorization header
    if (!user) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        logger.debug('Debug session - Using Bearer token for authentication');
        
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
    
    logger.debug('User check', { 
      hasUser: !!user, 
      hasError: !!userError,
      userId: user?.id 
    });
    
    // Check if we can access the database
    let dbAccess = false;
    let dbError = null;
    
    if (user) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('id', user.id)
          .single();
        
        dbAccess = !profileError && !!profile;
        dbError = profileError?.message;
        
        logger.debug('Database access check', { 
          dbAccess, 
          hasError: !!dbError,
          profileFound: !!profile 
        });
      } catch (dbTestError) {
        dbError = dbTestError instanceof Error ? dbTestError.message : 'Unknown error';
        logger.error('Database test failed', dbTestError);
      }
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cookies: {
        total: allCookies.length,
        sessionCookies: sessionCookies.map(c => c.name),
        allCookieNames: allCookies.map(c => c.name)
      },
      session: {
        hasSession: !!session,
        sessionError: sessionError?.message,
        userId: session?.user?.id,
        email: session?.user?.email,
        expiresAt: session?.expires_at
      },
      user: {
        hasUser: !!user,
        userError: userError?.message,
        userId: user?.id,
        email: user?.email
      },
      database: {
        canAccess: dbAccess,
        error: dbError
      },
      summary: {
        isAuthenticated: !!user && !userError,
        hasValidSession: !!session && !sessionError,
        canAccessDatabase: dbAccess
      }
    });

  } catch (error) {
    logger.error('Debug session error', error);
    return NextResponse.json(
      { 
        error: 'Debug session failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
