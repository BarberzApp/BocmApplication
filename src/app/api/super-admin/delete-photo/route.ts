import { NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

const SUPER_ADMIN_EMAIL = 'primbocm@gmail.com'

export async function POST(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Verify the token and get user info
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user || user.email !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userId, photoType, photoUrl, photoId } = body

    if (!userId || !photoType || !photoUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, photoType, photoUrl' },
        { status: 400 }
      )
    }

    // Verify user exists
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Delete from storage first
    try {
      // Extract bucket and path from URL
      // Supabase storage URLs are typically: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
      const url = new URL(photoUrl)
      const pathParts = url.pathname.split('/').filter(part => part !== '')
      
      // Find the 'public' index - bucket comes after it
      const publicIndex = pathParts.findIndex(part => part === 'public')
      
      if (publicIndex !== -1 && pathParts[publicIndex + 1]) {
        const bucket = pathParts[publicIndex + 1]
        const filePath = pathParts.slice(publicIndex + 2).join('/')
        
        // Remove query parameters from file path
        const cleanPath = filePath.split('?')[0]
        
        logger.info('Attempting to delete from storage', { bucket, path: cleanPath })
        
        const { error: storageError } = await supabaseAdmin.storage
          .from(bucket)
          .remove([cleanPath])

        if (storageError) {
          logger.warn('Error deleting from storage (may not exist)', { error: storageError, bucket, path: cleanPath })
          // Continue even if storage deletion fails (file might not exist)
        } else {
          logger.info('Successfully deleted from storage', { bucket, path: cleanPath })
        }
      } else {
        logger.warn('Could not parse storage URL (may be external URL)', { url: photoUrl })
        // Continue with database update even if we can't parse the URL
      }
    } catch (storageError) {
      logger.warn('Error processing storage deletion', { error: storageError })
      // Continue with database update
    }

    // Update database based on photo type
    let updateError = null

    switch (photoType) {
      case 'avatar':
        // Remove avatar_url from profile
        const { error: avatarError } = await supabaseAdmin
          .from('profiles')
          .update({ avatar_url: null })
          .eq('id', userId)
        updateError = avatarError
        break

      case 'cover':
        // Remove coverphoto from profile
        const { error: coverError } = await supabaseAdmin
          .from('profiles')
          .update({ coverphoto: null })
          .eq('id', userId)
        updateError = coverError
        break

      case 'portfolio':
        // Remove from barber's portfolio array
        const { data: barber, error: barberFetchError } = await supabaseAdmin
          .from('barbers')
          .select('id, portfolio')
          .eq('user_id', userId)
          .single()

        if (barberFetchError || !barber) {
          return NextResponse.json(
            { error: 'Barber record not found' },
            { status: 404 }
          )
        }

        const updatedPortfolio = (barber.portfolio || []).filter((url: string) => url !== photoUrl)
        const { error: portfolioError } = await supabaseAdmin
          .from('barbers')
          .update({ portfolio: updatedPortfolio })
          .eq('id', barber.id)
        updateError = portfolioError
        break

      case 'cut':
        // Delete cut/reel record
        if (!photoId) {
          return NextResponse.json(
            { error: 'photoId required for cut deletion' },
            { status: 400 }
          )
        }
        const { error: cutError } = await supabaseAdmin
          .from('cuts')
          .delete()
          .eq('id', photoId)
        updateError = cutError
        break

      default:
        return NextResponse.json(
          { error: `Invalid photo type: ${photoType}` },
          { status: 400 }
        )
    }

    if (updateError) {
      logger.error('Error updating database', updateError)
      return NextResponse.json(
        { error: 'Failed to update database' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${getPhotoTypeLabel(photoType)} deleted successfully`,
    })
  } catch (error) {
    logger.error('Delete photo error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getPhotoTypeLabel(type: string): string {
  switch (type) {
    case 'avatar':
      return 'Avatar'
    case 'cover':
      return 'Cover photo'
    case 'portfolio':
      return 'Portfolio image'
    case 'cut':
      return 'Cut/reel'
    default:
      return 'Photo'
  }
}

