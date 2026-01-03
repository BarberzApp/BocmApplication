export interface NotFoundSuggestion {
  title: string
  description: string
  href: string
  icon: 'search' | 'scissors' | 'user' | 'calendar' | 'settings'
}

// User type that matches what useAuth returns
type User = {
  id: string
  name: string
  email: string
  role?: 'client' | 'barber'
  [key: string]: any
}

/**
 * Generates smart navigation suggestions based on the pathname and user context
 * @param pathname - The current pathname that resulted in 404
 * @param user - The current user object or null if not authenticated
 * @returns Array of up to 3 most relevant suggestions
 */
export function getNotFoundSuggestions(
  pathname: string,
  user: User | null
): NotFoundSuggestion[] {
  const suggestions: NotFoundSuggestion[] = []
  const lowerPath = pathname.toLowerCase()

  // URL pattern-based suggestions
  if (lowerPath.includes('barber')) {
    if (user?.role === 'barber') {
      suggestions.push({
        title: 'Barber Dashboard',
        description: 'Access your barber dashboard',
        href: '/barber',
        icon: 'scissors'
      })
    } else {
      suggestions.push({
        title: 'Find Barbers',
        description: 'Browse available barbers',
        href: '/browse',
        icon: 'search'
      })
    }
  }

  if (lowerPath.includes('book')) {
    suggestions.push({
      title: 'Browse Barbers',
      description: 'Find a barber to book with',
      href: '/browse',
      icon: 'search'
    })
    if (user) {
      suggestions.push({
        title: 'My Bookings',
        description: 'View your existing bookings',
        href: '/booking',
        icon: 'calendar'
      })
    }
  }

  if (lowerPath.includes('profile') || lowerPath.includes('account')) {
    if (user) {
      suggestions.push({
        title: 'My Profile',
        description: 'View and edit your profile',
        href: '/profile',
        icon: 'user'
      })
    } else {
      suggestions.push({
        title: 'Login',
        description: 'Sign in to access your profile',
        href: '/login',
        icon: 'user'
      })
    }
  }

  if (lowerPath.includes('setting')) {
    if (user) {
      suggestions.push({
        title: 'Settings',
        description: 'Manage your account settings',
        href: '/settings',
        icon: 'settings'
      })
    }
  }

  if (lowerPath.includes('admin')) {
    if (user?.email === 'primbocm@gmail.com') {
      suggestions.push({
        title: 'Super Admin Panel',
        description: 'Access admin features',
        href: '/super-admin',
        icon: 'settings'
      })
    }
  }

  // User context-based suggestions
  if (user) {
    if (user.role === 'barber') {
      // Only add if not already in suggestions
      if (!suggestions.some(s => s.href === '/barber')) {
        suggestions.push({
          title: 'Barber Dashboard',
          description: 'Manage your services and bookings',
          href: '/barber',
          icon: 'scissors'
        })
      }
    }
    
    // Only add if not already in suggestions
    if (!suggestions.some(s => s.href === '/booking')) {
      suggestions.push({
        title: 'My Bookings',
        description: 'View your appointment history',
        href: '/booking',
        icon: 'calendar'
      })
    }
  }

  // Always include browse as fallback if not already present
  if (!suggestions.some(s => s.href === '/browse')) {
    suggestions.push({
      title: 'Browse Barbers',
      description: 'Find and book with top barbers',
      href: '/browse',
      icon: 'search'
    })
  }

  // Return top 3 most relevant suggestions
  return suggestions.slice(0, 3)
}

