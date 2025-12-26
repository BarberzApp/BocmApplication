import { NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'primbocm@gmail.com'
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD

export async function POST(request: Request) {
  try {
    // Validate environment variable
    if (!SUPER_ADMIN_PASSWORD) {
      logger.error('SUPER_ADMIN_PASSWORD environment variable is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const body = await request.json()
    const { email, password } = body

    // Only allow the specific super admin credentials
    if (email !== SUPER_ADMIN_EMAIL || password !== SUPER_ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD
    })

    if (error) {
      logger.error('Super admin auth error', error)
      return NextResponse.json(
        { error: error.message || 'Authentication failed' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: 'super_admin'
      },
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token
      }
    })
  } catch (error) {
    logger.error('Super admin auth error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 