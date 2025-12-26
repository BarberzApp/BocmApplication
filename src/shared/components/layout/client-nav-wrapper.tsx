"use client";
import { Navbar } from "@/shared/components/layout/navbar";
import { MobileNav } from "@/shared/components/layout/mobile-nav";
import React, { useState, useEffect } from "react";

export default function ClientNavWrapper({ children }: { children: React.ReactNode }) {
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

  // Define pages where navigation should be hidden
  const hiddenPages = ["/", "/landing"];
  
  // Determine what to show
  const showNavbar = pathname ? !hiddenPages.includes(pathname) : true;
  const isSettingsPage = pathname?.startsWith('/settings') || false;
  const isProfilePage = pathname?.startsWith('/profile') || false;
  const shouldShowNav = showNavbar || isSettingsPage || isProfilePage;
  const showMobileNav = showNavbar || isSettingsPage || isProfilePage;

  // Debug logging can be re-enabled if needed

  return (
    <>
      {shouldShowNav && <Navbar />}
      <div>
        {children}
      </div>
      {showMobileNav && <MobileNav />}
    </>
  );
} 