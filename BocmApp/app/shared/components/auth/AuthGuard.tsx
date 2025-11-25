import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { useSafeNavigation } from '../../hooks/useSafeNavigation';
import { theme } from '../../lib/theme';
import { logger } from '../../lib/logger';
import tw from 'twrnc';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'client' | 'barber' | 'admin';
  fallbackRoute?: string;
  showLoading?: boolean;
}

export function AuthGuard({ 
  children, 
  requiredRole, 
  fallbackRoute = 'Login',
  showLoading = true 
}: AuthGuardProps) {
  const { user, userProfile, loading } = useAuth();
  const { push } = useSafeNavigation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!loading) {
      // Check if user is authenticated
      if (!user) {
        logger.log('🔒 AuthGuard: User not authenticated, redirecting to login');
        push(fallbackRoute);
        return;
      }

      // Check if user has required role
      if (requiredRole && userProfile?.role !== requiredRole) {
        logger.log(`🔒 AuthGuard: User role ${userProfile?.role} does not match required role ${requiredRole}`);
        
        // Redirect based on user role
        switch (userProfile?.role) {
          case 'barber':
            push('MainTabs');
            break;
          case 'client':
            push('MainTabs');
            break;
          default:
            push(fallbackRoute);
        }
        return;
      }

      setIsChecking(false);
    }
  }, [user, userProfile, loading, requiredRole, push, fallbackRoute]);

  // Show loading while checking authentication
  if (loading || isChecking) {
    if (!showLoading) return null;
    
    return (
      <View style={[tw`flex-1 justify-center items-center`, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // User is authenticated and has required role
  return <>{children}</>;
}

// Higher-order component for role-based protection
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  requiredRole?: 'client' | 'barber' | 'admin',
  fallbackRoute?: string
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <AuthGuard requiredRole={requiredRole} fallbackRoute={fallbackRoute}>
        <Component {...props} />
      </AuthGuard>
    );
  };
}

// Specific role guards
export function BarberGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="barber" fallbackRoute="Login">
      {children}
    </AuthGuard>
  );
}

export function ClientGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="client" fallbackRoute="Login">
      {children}
    </AuthGuard>
  );
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="admin" fallbackRoute="Login">
      {children}
    </AuthGuard>
  );
} 