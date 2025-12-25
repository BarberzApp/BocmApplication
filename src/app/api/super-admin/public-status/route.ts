import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

const SUPER_ADMIN_EMAIL = 'primbocm@gmail.com'

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.debug('Missing authorization header')
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Verify the token and get user info
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user || user.email !== SUPER_ADMIN_EMAIL) {
      logger.debug('Access denied for user', { email: user?.email, error: authError })
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const { userId, isPublic } = await request.json()
    logger.debug('Processing public status update', { userId, isPublic })

    if (!userId || typeof isPublic !== 'boolean') {
      logger.debug('Invalid parameters', { userId, isPublic })
      return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 })
    }

    // First, verify the profile exists using admin client
    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, is_public')
      .eq('id', userId)
      .single()

    if (fetchError || !existingProfile) {
      logger.error('Profile not found', { userId, error: fetchError })
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    logger.debug('Updating profile', { 
      name: existingProfile.name, 
      email: existingProfile.email,
      currentIsPublic: existingProfile.is_public,
      newIsPublic: isPublic
    })

    // Update the profile's public status using admin client
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_public: isPublic })
      .eq('id', userId)

    if (error) {
      logger.error('Error updating public status', error)
      return NextResponse.json({ success: false, error: 'Failed to update public status' }, { status: 500 })
    }

    logger.debug('Successfully updated public status', { name: existingProfile.name })

    return NextResponse.json({ 
      success: true, 
      message: `Profile visibility updated to ${isPublic ? 'public' : 'private'}`,
      data: {
        userId,
        isPublic,
        profileName: existingProfile.name
      }
    })

  } catch (error) {
    logger.error('Error in public status update', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
} 