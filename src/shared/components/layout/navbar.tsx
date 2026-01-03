"use client"
import Link from "next/link"
import { useAuth } from "@/shared/hooks/use-auth-zustand"
import { useAdminAuth } from "@/shared/hooks/useAdminAuth"
import { logger } from "@/shared/lib/logger"
import { useEffect, useCallback, useState } from "react"
import { Button } from "@/shared/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar"
// ModeToggle removed - dark mode disabled
import { MobileNav } from "@/shared/components/layout/mobile-nav"
import { useMobile } from "@/shared/hooks/use-mobile"
import {
  User,
  LogOut,
  Settings,
  Calendar,
  Scissors,
  Search,
  UserCircle,
  Video,
  Compass,
  Bell,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { UpdatesBadge } from "@/shared/components/updates/updates-badge"
import { NotificationBell } from "@/shared/notifications/notification-bell"
import { LogoBrand } from "@/shared/components/layout/logo-brand"

export function Navbar() {
  const { user } = useAuth();
  const { isAdmin } = useAdminAuth();
  const [pathname, setPathname] = useState<string>('');

  // Update pathname when component mounts and when route changes
  useEffect(() => {
    // Set initial pathname
    setPathname(window.location.pathname);

    // Listen for route changes
    const handleRouteChange = () => {
      setPathname(window.location.pathname);
    };

    // Add event listener for popstate (back/forward navigation)
    window.addEventListener('popstate', handleRouteChange);

    // Listen for navigation events
    const handleNavigation = () => {
      // Small delay to ensure the route has changed
      setTimeout(() => {
        setPathname(window.location.pathname);
      }, 0);
    };

    // Listen for clicks on navigation links
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A' || target.closest('a')) {
        handleNavigation();
      }
    });

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      document.removeEventListener('click', handleNavigation);
    };
  }, []);

  // Don't show on home page, but show on all other pages including settings
  if (pathname === '/') return null;

  const roleSpecificNavItems = () => {
    if (!user) return []

    if (isAdmin) {
      return [
        {
          href: "/super-admin",
          icon: User,
          label: "Admin",
        },
      ]
    }

    if (user.role === "barber") {
      return [
        {
          href: "/calendar",
          icon: Calendar,
          label: "Calendar",
        },
      ]
    }

    return [
      {
        href: "/calendar",
        icon: Calendar,
        label: "Bookings",
      },
    ]
  }

  const handleLogout = async () => {
    const { logout } = useAuth();

    try {
      await logout()
      window.location.href = "/"
    } catch (error) {
      logger.error("Logout failed", error)
    }
  }

  if (useMobile()) {
    return <MobileNav />
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/20 backdrop-blur-xl shadow-2xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <LogoBrand size="sm" asLink showGlow />
        </div>
        
        {user ? (
          // Authenticated user navigation
          <nav className="hidden md:flex items-center space-x-6">
            {/* Role-specific navigation items */}
            {roleSpecificNavItems().map((item) => {
              const isActive = pathname === item.href || 
                (item.href === "/calendar" && pathname?.startsWith("/calendar")) ||
                (isAdmin && item.href === "/super-admin" && pathname?.startsWith("/super-admin"))
              // If the user is an admin and the href is "/super-admin", show the admin link
              if (isAdmin && item.href === "/super-admin") {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "text-white/80 hover:text-saffron transition-all duration-300 font-medium px-4 py-2 rounded-xl flex items-center gap-2 group relative",
                      isActive 
                        ? "text-saffron bg-saffron/10 shadow-lg shadow-saffron/20 border border-saffron/30" 
                        : "hover:bg-white/5 hover:shadow-md"
                    )}
                  >
                    <item.icon className={cn(
                      "h-4 w-4 transition-all duration-300",
                      isActive ? "text-saffron scale-110" : "group-hover:scale-105"
                    )} />
                    {item.label}
                    {isActive && (
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-saffron rounded-full" />
                    )}
                  </Link>
                )
              }
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-white/80 hover:text-saffron transition-all duration-300 font-medium px-4 py-2 rounded-xl flex items-center gap-2 group relative",
                    isActive 
                      ? "text-saffron bg-saffron/10 shadow-lg shadow-saffron/20 border border-saffron/30" 
                      : "hover:bg-white/5 hover:shadow-md"
                  )}
                >
                  <item.icon className={cn(
                    "h-4 w-4 transition-all duration-300",
                    isActive ? "text-saffron scale-110" : "group-hover:scale-105"
                  )} />
                  {item.label}
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-saffron rounded-full" />
                  )}
                </Link>
              )

            })}
            
            {/* Browse link for all users */}
            <Link 
              href="/browse" 
              className={cn(
                "text-white/80 hover:text-saffron transition-all duration-300 font-medium px-4 py-2 rounded-xl flex items-center gap-2 group relative",
                pathname === "/browse" || pathname?.startsWith("/browse")
                  ? "text-saffron bg-saffron/10 shadow-lg shadow-saffron/20 border border-saffron/30" 
                  : "hover:bg-white/5 hover:shadow-md"
              )}
            >
              <Compass className={cn(
                "h-4 w-4 transition-all duration-300",
                pathname === "/browse" || pathname?.startsWith("/browse") ? "text-saffron scale-110" : "group-hover:scale-105"
              )} />
              Browse
              {(pathname === "/browse" || pathname?.startsWith("/browse")) && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-saffron rounded-full" />
              )}
            </Link>
            
            {/* Notification Bell */}
            <div className="flex items-center gap-2">
              <NotificationBell />
              
              {/* User dropdown menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-300 hover:border-saffron/30 hover:shadow-lg hover:shadow-saffron/20"
                  >
                    {user?.avatar_url ? (
                      <img 
                        src={user.avatar_url} 
                        alt="Profile" 
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-white" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-black/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl">
                  <DropdownMenuLabel className="text-white/80 font-medium px-3 py-2">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  {/* Profile tab for all users */}
                  <DropdownMenuItem asChild className="p-3 hover:bg-white/10 focus:bg-white/10 cursor-pointer rounded-xl mx-2 my-1">
                    <Link href="/profile" className="text-white hover:text-saffron transition-colors flex items-center gap-3">
                      <User className="h-4 w-4" />
                      <span className="font-medium">Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="p-3 hover:bg-white/10 focus:bg-white/10 cursor-pointer rounded-xl mx-2 my-1">
                    <Link href="/settings" className="text-white hover:text-saffron transition-colors flex items-center gap-3">
                      <Settings className="h-4 w-4" />
                      <span className="font-medium">Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    className="p-3 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer text-red-400 hover:text-red-300 transition-colors rounded-xl mx-2 my-1"
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    <span className="font-medium">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </nav>
        ) : (
          // Unauthenticated user navigation
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/browse" className="text-white/80 hover:text-saffron transition-all duration-300 font-medium px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-white/5">
              <Compass className="h-4 w-4" />
              Browse
            </Link>
            <Link href="/login" className="text-white/80 hover:text-saffron transition-all duration-300 font-medium px-4 py-2 rounded-xl hover:bg-white/5">
              Login
            </Link>
            <Link href="/register" className="bg-saffron text-primary px-6 py-2 rounded-xl font-semibold hover:bg-saffron/90 shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-saffron/20">
              Get Started
            </Link>
          </nav>
        )}
      </div>
    </nav>
  )
}
