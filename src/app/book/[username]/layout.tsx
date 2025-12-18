import { Metadata } from 'next'
import { supabase } from '@/shared/lib/supabase'

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  try {
    // Fetch barber details
    const { data: barberData, error } = await supabase
      .from('barbers')
      .select(`
        id,
        bio,
        specialties,
        profiles (
          name,
          username,
          location,
          avatar_url,
          coverphoto
        )
      `)
      .eq('profiles.username', params.username)
      .single()

    const atUsername = params.username ? `@${params.username}` : 'Barber'

    if (error || !barberData) {
      return {
        title: `${atUsername} - BOCM Style`,
        description: 'Book your next haircut with a professional barber on BOCM Style.',
        openGraph: {
          title: `${atUsername} - BOCM Style`,
          description: 'Book your next haircut with a professional barber on BOCM Style.',
          type: 'website',
          url: `https://bocmstyle.com/book/${params.username}`,
          images: [
            {
              url: 'https://bocmstyle.com/BocmLogo.png',
              width: 1200,
              height: 630,
              alt: 'BOCM Style - Professional Barber Booking',
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title: `${atUsername} - BOCM Style`,
          description: 'Book your next haircut with a professional barber on BOCM Style.',
          images: ['https://bocmstyle.com/BocmLogo.png'],
        },
      }
    }

    const barber = barberData
    const profile = barber.profiles?.[0]
    const barberName = profile?.name || atUsername
    const barberBio = barber.bio || 'Professional barber offering quality haircuts and styling services.'
    const barberLocation = profile?.location || ''
    const barberImage = profile?.avatar_url || profile?.coverphoto || 'https://bocmstyle.com/BocmLogo.png'
    
    // Create specialties text
    const specialtiesText = barber.specialties && barber.specialties.length > 0 
      ? `Specializing in ${barber.specialties.join(', ')}` 
      : ''

    const fullDescription = `${barberBio}${barberLocation ? ` Located in ${barberLocation}.` : ''} ${specialtiesText} Book your appointment today!`

    return {
      title: `${atUsername} - BOCM Style`,
      description: fullDescription,
      openGraph: {
        title: `${atUsername} - BOCM Style`,
        description: fullDescription,
        type: 'website',
        url: `https://bocmstyle.com/book/${params.username}`,
        images: [
          {
            url: barberImage,
            width: 1200,
            height: 630,
            alt: `${barberName} - Professional Barber`,
          },
        ],
        siteName: 'BOCM Style',
        locale: 'en_US',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${atUsername} - BOCM Style`,
        description: fullDescription,
        images: [barberImage],
        creator: '@bocmstyle',
      },
      other: {
        'theme-color': '#FF6B35', // Saffron color
        'msapplication-TileColor': '#FF6B35',
        'apple-mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-status-bar-style': 'black-translucent',
      },
    }
  } catch (error) {
    logger.error('Error generating metadata', error)
    
    // Fallback metadata
    const atUsername = params.username ? `@${params.username}` : 'Barber'
    return {
      title: `${atUsername} - BOCM Style`,
      description: 'Book your next haircut with a professional barber on BOCM Style.',
      openGraph: {
        title: `${atUsername} - BOCM Style`,
        description: 'Book your next haircut with a professional barber on BOCM Style.',
        type: 'website',
        url: `https://bocmstyle.com/book/${params.username}`,
        images: [
          {
            url: 'https://bocmstyle.com/BocmLogo.png',
            width: 1200,
            height: 630,
            alt: 'BOCM Style - Professional Barber Booking',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${atUsername} - BOCM Style`,
        description: 'Book your next haircut with a professional barber on BOCM Style.',
        images: ['https://bocmstyle.com/BocmLogo.png'],
      },
    }
  }
}

export default function BookLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 