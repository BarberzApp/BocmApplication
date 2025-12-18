"use client"

import * as React from "react"
import { useCallback, useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { Home, Search, Settings as SettingsIcon, Calendar, User, Video, DollarSign, Users, LogOut } from "lucide-react"
import { useAuth } from "@/shared/hooks/use-auth-zustand"
import { cn } from "@/shared/lib/utils"
import { logger } from "@/shared/lib/logger"

export function MobileNav() {
  const [pathname, setPathname] = useState<string>('')
  const { user, logout } = useAuth()

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

  const baseNavItems = [
    { name: "Browse", href: "/browse", icon: Search },
    { name: "Profile", href: "/settings/barber-profile", icon: User },
  ]

  const roleSpecificNavItems = useMemo(() => {
    if (!user) return []
    
    switch (user.role) {
      case "client":
        return [
          { name: "Bookings", href: "/calendar", icon: Calendar },
        ]
      case "barber":
        return [
          { name: "Calendar", href: "/calendar", icon: Calendar },
        ]
      default:
        return []
    }
  }, [user?.role])

  const allNavItems = [...baseNavItems, ...roleSpecificNavItems, { name: "Settings", href: "/settings", icon: SettingsIcon }]

  // Handler for logout
  const handleLogout = async () => {
    try {
      await logout()
      window.location.href = "/"
    } catch (error) {
      logger.error("Logout failed", error)
    }
  }

  // Custom nav order: Browse | Calendar | Profile | Settings
  function getOrderedNavItems() {
    const browse = allNavItems.find(item => item.href === '/browse');
    const calendar = allNavItems.find(item => item.href === '/calendar');
    const profile = allNavItems.find(item => item.href === '/settings/barber-profile');
    const settings = allNavItems.find(item => item.href === '/settings');
    
    return [browse, calendar, profile, settings].filter(Boolean);
  }
  
  const orderedNavItems = getOrderedNavItems();
  const centerIndex = 1; // Center the calendar item
  const leftItems = orderedNavItems.slice(0, centerIndex);
  const centerItem = orderedNavItems[centerIndex];
  const rightItems = orderedNavItems.slice(centerIndex + 1, centerIndex + 3);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[1000] md:hidden">
      {/* Modern glass morphism background */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl border-t border-white/10 shadow-2xl" />
      
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      
      {/* Main navigation container */}
      <div className="relative flex items-center justify-center gap-2 px-4 py-6 h-[120px] pb-safe">
        {/* Left navigation items */}
        {leftItems.filter(Boolean).map((item) => {
          if (!item) return null;
          const isActive = pathname === item.href || 
            (item.href === "/settings/barber-profile" && pathname.startsWith("/settings")) ||
            (item.href === "/settings" && pathname.startsWith("/settings")) ||
            (item.href === "/calendar" && pathname.startsWith("/calendar")) ||
            (item.href === "/browse" && pathname.startsWith("/browse"))
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center py-3 px-4 rounded-2xl transition-all duration-300 min-w-[64px] group",
                isActive 
                  ? "text-saffron bg-saffron/15 shadow-lg shadow-saffron/25 border border-saffron/30 backdrop-blur-sm" 
                  : "text-white/80 hover:text-saffron hover:bg-white/10 hover:shadow-md backdrop-blur-sm"
              )}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-saffron rounded-full shadow-lg shadow-saffron/50" />
              )}
              
              <item.icon 
                className={cn(
                  "h-6 w-6 mb-1 transition-all duration-300",
                  isActive ? "text-saffron scale-110" : "text-white/80 group-hover:scale-105 group-hover:text-saffron"
                )} 
              />
              <span className={cn(
                "text-xs font-semibold transition-all duration-300 tracking-wide",
                isActive ? "text-saffron" : "text-white/80 group-hover:text-saffron"
              )}>
                {item.name}
              </span>
            </Link>
          )
        })}

        {/* Center item (highlighted) - modern design */}
        {centerItem && (
          <Link
            key={centerItem.href}
            href={centerItem.href}
            className={cn(
              "relative flex flex-col items-center justify-center py-4 px-5 rounded-3xl transition-all duration-300 min-w-[80px] scale-110 group",
              "bg-gradient-to-br from-saffron via-saffron/90 to-saffron/80 shadow-2xl shadow-saffron/40",
              "border-2 border-saffron/60 hover:border-saffron/80",
              "hover:scale-115 hover:shadow-saffron/50 hover:shadow-2xl",
              pathname === centerItem.href ? "ring-2 ring-saffron/60 ring-offset-2 ring-offset-black/50" : ""
            )}
          >
            {/* Enhanced glow effect */}
            <div className="absolute inset-0 rounded-3xl bg-saffron/30 blur-xl opacity-60" />
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-saffron/20 to-transparent" />
            
            <centerItem.icon className="h-6 w-6 mb-1 text-primary drop-shadow-lg relative z-10 group-hover:scale-110 transition-transform duration-300" />
            <span className="text-xs font-bold text-primary drop-shadow flex items-center relative z-10 tracking-wide">
              {centerItem.name}
            </span>
          </Link>
        )}

        {/* Right navigation items */}
        {rightItems.filter(Boolean).map((item) => {
          if (!item) return null;
          const isActive = pathname === item.href || 
            (item.href === "/settings/barber-profile" && pathname.startsWith("/settings")) ||
            (item.href === "/settings" && pathname.startsWith("/settings")) ||
            (item.href === "/calendar" && pathname.startsWith("/calendar")) ||
            (item.href === "/browse" && pathname.startsWith("/browse"))
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center py-3 px-4 rounded-2xl transition-all duration-300 min-w-[64px] group",
                isActive 
                  ? "text-saffron bg-saffron/15 shadow-lg shadow-saffron/25 border border-saffron/30 backdrop-blur-sm" 
                  : "text-white/80 hover:text-saffron hover:bg-white/10 hover:shadow-md backdrop-blur-sm"
              )}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-saffron rounded-full shadow-lg shadow-saffron/50" />
              )}
              
              <item.icon 
                className={cn(
                  "h-6 w-6 mb-1 transition-all duration-300",
                  isActive ? "text-saffron scale-110" : "text-white/80 group-hover:scale-105 group-hover:text-saffron"
                )} 
              />
              <span className={cn(
                "text-xs font-semibold transition-all duration-300 tracking-wide",
                isActive ? "text-saffron" : "text-white/80 group-hover:text-saffron"
              )}>
                {item.name}
              </span>
            </Link>
          )
        })}


      </div>
    </div>
  )
}

