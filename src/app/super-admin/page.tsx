'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { logger } from '@/shared/lib/logger'
import { useToast } from '@/shared/components/ui/use-toast'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Switch } from '@/shared/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { 
  Loader2, 
  Shield, 
  Users, 
  Crown, 
  LogOut, 
  Search, 
  UserX, 
  UserCheck, 
  Settings, 
  Eye, 
  Edit, 
  Trash2,
  AlertTriangle,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Building,
  DollarSign,
  Activity,
  Ban,
  CheckCircle,
  Clock,
  Star,
  TrendingUp,
  Database,
  Globe,
  Bell,
  Zap,
  BarChart3,
  MessageSquare,
  Key,
  Lock,
  Unlock,
  RefreshCw,
  Download,
  Upload,
  Archive,
  AlertCircle,
  Info,
  HelpCircle
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'

interface Barber {
  id: string
  user_id: string
  business_name: string
  is_developer: boolean
  created_at: string
  profiles: {
    id: string
    name: string
    email: string
    role: string
    phone?: string
    location?: string
    bio?: string
    is_disabled?: boolean
    join_date?: string
    avatar_url?: string
    is_public?: boolean
  }
  services?: Array<{
    id: string
    name: string
    price: number
    duration: number
  }>
  bookings?: Array<{
    id: string
    status: string
    created_at: string
  }>
}

interface UserStats {
  totalUsers: number
  totalBarbers: number
  totalClients: number
  disabledAccounts: number
  developers: number
  activeBookings: number
  totalRevenue: number
  pendingReviews: number
  newUsersToday: number
  revenueToday: number
}

export default function SuperAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [updatingBarber, setUpdatingBarber] = useState<string | null>(null)
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    totalBarbers: 0,
    totalClients: 0,
    disabledAccounts: 0,
    developers: 0,
    activeBookings: 0,
    totalRevenue: 0,
    pendingReviews: 0,
    newUsersToday: 0,
    revenueToday: 0
  })
  const [activeTab, setActiveTab] = useState('dashboard')
  const [systemStatus, setSystemStatus] = useState({
    database: 'healthy',
    api: 'healthy',
    payments: 'healthy',
    notifications: 'healthy'
  })
  const router = useRouter()
  const { toast } = useToast()

  // Check if user is super admin
  useEffect(() => {
    const checkSuperAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.email === 'primbocm@gmail.com') {
          setIsAuthenticated(true)
          fetchBarbers()
          fetchStats()
          checkSystemStatus()
        }
      } catch (error) {
        logger.error('Error checking super admin', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkSuperAdmin()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'primbocm@gmail.com',
        password: password
      })

      if (error) {
        toast({
          title: 'Access Denied',
          description: error.message || 'Invalid credentials',
          variant: 'destructive',
        })
        return
      }

      if (data.user?.email === 'primbocm@gmail.com') {
        setIsAuthenticated(true)
        fetchBarbers()
        fetchStats()
        checkSystemStatus()
        toast({
          title: 'Super Admin Access Granted',
          description: 'Welcome to the Super Admin Panel',
        })
      } else {
        toast({
          title: 'Access Denied',
          description: 'Only super admin can access this page',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Login Failed',
        description: 'Network error. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchBarbers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No session token available')
      }

      const response = await fetch('/api/super-admin/barbers', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setBarbers(data.barbers)
      } else {
        throw new Error(data.error || 'Failed to fetch barbers')
      }
    } catch (error) {
      logger.error('Error fetching barbers', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch barbers',
        variant: 'destructive',
      })
    }
  }

  const fetchStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No session token available')
      }

      const response = await fetch('/api/super-admin/stats', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      logger.error('Error fetching stats', error)
    }
  }

  const checkSystemStatus = async () => {
    // Simulate system status check
    setSystemStatus({
      database: 'healthy',
      api: 'healthy',
      payments: 'healthy',
      notifications: 'healthy'
    })
  }

  const toggleDeveloperStatus = async (barberId: string, currentStatus: boolean) => {
    setUpdatingBarber(barberId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No session token available')
      }

      const response = await fetch('/api/super-admin/developer-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          barberId,
          isDeveloper: !currentStatus
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setBarbers(prev => prev.map(barber => 
          barber.id === barberId 
            ? { ...barber, is_developer: !currentStatus }
            : barber
        ))

        toast({
          title: 'Developer Status Updated',
          description: data.message,
        })
      } else {
        throw new Error(data.error || 'Failed to update developer status')
      }
    } catch (error) {
      logger.error('Error updating developer status', error)
      toast({
        title: 'Error',
        description: 'Failed to update developer status',
        variant: 'destructive',
      })
    } finally {
      setUpdatingBarber(null)
    }
  }

  const toggleAccountStatus = async (userId: string, currentStatus: boolean) => {
    setUpdatingBarber(userId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No session token available')
      }

      const response = await fetch('/api/super-admin/account-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId,
          isDisabled: !currentStatus
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setBarbers(prev => prev.map(barber => 
          barber.user_id === userId 
            ? { 
                ...barber, 
                profiles: { 
                  ...barber.profiles, 
                  is_disabled: !currentStatus 
                } 
              }
            : barber
        ))

        toast({
          title: 'Account Status Updated',
          description: data.message,
        })
      } else {
        throw new Error(data.error || 'Failed to update account status')
      }
    } catch (error) {
      logger.error('Error updating account status', error)
      toast({
        title: 'Error',
        description: 'Failed to update account status',
        variant: 'destructive',
      })
    } finally {
      setUpdatingBarber(null)
    }
  }

  const togglePublicStatus = async (userId: string, currentStatus: boolean) => {
    setUpdatingBarber(userId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No session token available')
      }

      const newStatus = !currentStatus
      logger.debug(`Toggling public status for user ${userId}`, { currentStatus, newStatus })

      const response = await fetch('/api/super-admin/public-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId,
          isPublic: newStatus
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Update local state
        setBarbers(prev => prev.map(barber => 
          barber.user_id === userId 
            ? { 
                ...barber, 
                profiles: { 
                  ...barber.profiles, 
                  is_public: newStatus 
                } 
              }
            : barber
        ))

        logger.debug(`Successfully updated public status to: ${newStatus}`)
        toast({
          title: 'Profile Visibility Updated',
          description: `Profile is now ${newStatus ? 'public' : 'private'}`,
        })
      } else {
        logger.error('API Error updating public status', new Error(data.error || 'Failed to update public status'))
        throw new Error(data.error || 'Failed to update public status')
      }
    } catch (error) {
      logger.error('Error updating public status', error)
      toast({
        title: 'Error',
        description: 'Failed to update profile visibility. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setUpdatingBarber(null)
    }
  }

  const updateUserRole = async (userId: string, newRole: string) => {
    setUpdatingBarber(userId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No session token available')
      }

      const response = await fetch('/api/super-admin/update-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId,
          role: newRole
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setBarbers(prev => prev.map(barber => 
          barber.user_id === userId 
            ? { 
                ...barber, 
                profiles: { 
                  ...barber.profiles, 
                  role: newRole 
                } 
              }
            : barber
        ))

        toast({
          title: 'Role Updated',
          description: `User role changed to ${newRole}`,
        })
      } else {
        throw new Error(data.error || 'Failed to update role')
      }
    } catch (error) {
      logger.error('Error updating role', error)
      toast({
        title: 'Error',
        description: 'Failed to update role',
        variant: 'destructive',
      })
    } finally {
      setUpdatingBarber(null)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setBarbers([])
    toast({
      title: 'Logged Out',
      description: 'You have been logged out of Super Admin',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const filteredBarbers = barbers.filter(barber =>
    barber.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    barber.profiles?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    barber.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-secondary" />
          <p className="text-white/60 font-medium">Loading Super Admin Panel...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/10 border border-white/20 shadow-2xl backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <Crown className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bebas text-white tracking-wide">
                  Super Admin Access
                </CardTitle>
                <CardDescription className="text-white/80 mt-1">
                  Restricted access only
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value="primbocm@gmail.com"
                  disabled
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter super admin password"
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Access Super Admin
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-primary">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-black/95 to-black/80 border-b border-white/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-xl">
                <Crown className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h1 className="text-xl font-bebas text-white tracking-wide">Super Admin Panel</h1>
                <p className="text-sm text-white/60">Complete Platform Management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-white/60 text-sm">Super Admin</p>
                <p className="text-white font-medium">primbocm@gmail.com</p>
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-white/10 border border-white/20 p-1 rounded-xl">
            <TabsTrigger value="dashboard" className="text-white data-[state=active]:bg-white/20 rounded-lg">
              <Activity className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="users" className="text-white data-[state=active]:bg-white/20 rounded-lg">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="developers" className="text-white data-[state=active]:bg-white/20 rounded-lg">
              <Zap className="h-4 w-4 mr-2" />
              Developers
            </TabsTrigger>
            <TabsTrigger value="reviews" className="text-white data-[state=active]:bg-white/20 rounded-lg">
              <MessageSquare className="h-4 w-4 mr-2" />
              Reviews
            </TabsTrigger>
            <TabsTrigger value="system" className="text-white data-[state=active]:bg-white/20 rounded-lg">
              <Database className="h-4 w-4 mr-2" />
              System
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-white data-[state=active]:bg-white/20 rounded-lg">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* System Status */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Object.entries(systemStatus).map(([service, status]) => (
                <Card key={service} className={`bg-white/5 border border-white/10 ${
                  status === 'healthy' ? 'border-green-400/50' : 'border-red-400/50'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/60 text-sm capitalize">{service}</p>
                        <p className={`text-white font-bold ${
                          status === 'healthy' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {status === 'healthy' ? 'Healthy' : 'Issue'}
                        </p>
                      </div>
                      <div className={`p-2 rounded-lg ${
                        status === 'healthy' ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        {status === 'healthy' ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-400" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-blue-400/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-200">Total Users</p>
                      <p className="text-2xl font-bold text-white">{stats.totalUsers.toLocaleString()}</p>
                      <p className="text-xs text-blue-300">+{stats.newUsersToday} today</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-300" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-500/20 to-green-600/20 border-green-400/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-200">Active Barbers</p>
                      <p className="text-2xl font-bold text-white">{stats.totalBarbers}</p>
                      <p className="text-xs text-green-300">{stats.developers} developers</p>
                    </div>
                    <Shield className="h-8 w-8 text-green-300" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-purple-400/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-200">Total Revenue</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</p>
                      <p className="text-xs text-purple-300">+{formatCurrency(stats.revenueToday)} today</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-purple-300" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border-yellow-400/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-yellow-200">Pending Reviews</p>
                      <p className="text-2xl font-bold text-white">{stats.pendingReviews}</p>
                      <p className="text-xs text-yellow-300">Awaiting moderation</p>
                    </div>
                    <MessageSquare className="h-8 w-8 text-yellow-300" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                onClick={() => setActiveTab('users')}
                className="h-20 bg-white/10 border border-white/20 hover:bg-white/20 text-white"
              >
                <div className="text-center">
                  <Users className="h-6 w-6 mx-auto mb-2" />
                  <p className="font-semibold">Manage Users</p>
                  <p className="text-xs text-white/60">Account management</p>
                </div>
              </Button>
              
              <Button 
                onClick={() => setActiveTab('developers')}
                className="h-20 bg-white/10 border border-white/20 hover:bg-white/20 text-white"
              >
                <div className="text-center">
                  <Zap className="h-6 w-6 mx-auto mb-2" />
                  <p className="font-semibold">Developer Mode</p>
                  <p className="text-xs text-white/60">Toggle developer status</p>
                </div>
              </Button>
              
              <Button 
                onClick={() => setActiveTab('reviews')}
                className="h-20 bg-white/10 border border-white/20 hover:bg-white/20 text-white"
              >
                <div className="text-center">
                  <MessageSquare className="h-6 w-6 mx-auto mb-2" />
                  <p className="font-semibold">Review Moderation</p>
                  <p className="text-xs text-white/60">Content moderation</p>
                </div>
              </Button>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">User Management</h2>
                <p className="text-white/60">Manage all user accounts and permissions</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                <Input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 w-80"
                />
              </div>
            </div>

            <div className="space-y-4">
              {filteredBarbers.map((barber) => (
                <Card key={barber.id} className={`transition-all duration-300 ${
                  barber.profiles?.is_disabled 
                    ? 'bg-gradient-to-r from-red-500/20 to-pink-500/20 border-red-400/50' 
                    : 'bg-white/10 border-white/20'
                }`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={barber.profiles?.avatar_url} />
                          <AvatarFallback className="bg-secondary text-white">
                            {barber.profiles?.name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-white">
                              {barber.profiles?.name || 'Unknown'}
                            </h3>
                            <Badge className={`font-bold px-2 py-1 text-xs ${
                              barber.profiles?.role === 'barber' 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-500 text-white'
                            }`}>
                              {barber.profiles?.role?.toUpperCase() || 'UNKNOWN'}
                            </Badge>
                                                         {barber.profiles?.is_disabled && (
                               <Badge className="bg-red-500 text-white font-bold px-2 py-1 text-xs">
                                 DISABLED
                               </Badge>
                             )}
                             {barber.profiles?.is_public ? (
                               <Badge className="bg-green-500 text-white font-bold px-2 py-1 text-xs">
                                 PUBLIC
                               </Badge>
                             ) : (
                               <Badge className="bg-gray-500 text-white font-bold px-2 py-1 text-xs">
                                 PRIVATE
                               </Badge>
                             )}
                          </div>
                          <p className="text-white/80 text-sm">{barber.profiles?.email}</p>
                          <p className="text-white/60 text-xs">
                            Joined: {new Date(barber.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                                              <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-sm font-semibold text-white mb-2">Role</p>
                            <Select
                              value={barber.profiles?.role || 'client'}
                              onValueChange={(value) => updateUserRole(barber.user_id, value)}
                              disabled={updatingBarber === barber.user_id}
                            >
                              <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="client">Client</SelectItem>
                                <SelectItem value="barber">Barber</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="text-center">
                            <p className="text-sm font-semibold text-white mb-2">Status</p>
                            <Switch
                              checked={!barber.profiles?.is_disabled}
                              onCheckedChange={() => toggleAccountStatus(barber.user_id, barber.profiles?.is_disabled || false)}
                              disabled={updatingBarber === barber.user_id}
                              className={`scale-125 transition-all duration-200 ${
                                !barber.profiles?.is_disabled
                                  ? 'bg-green-500 border-green-400 shadow-lg shadow-green-500/50' 
                                  : 'bg-red-500 border-red-400 shadow-lg shadow-red-500/50'
                              }`}
                            />
                          </div>

                          <div className="text-center">
                            <p className="text-sm font-semibold text-white mb-2">Visibility</p>
                            <Switch
                              checked={barber.profiles?.is_public}
                              onCheckedChange={() => togglePublicStatus(barber.user_id, barber.profiles?.is_public || false)}
                              disabled={updatingBarber === barber.user_id}
                              className={`scale-125 transition-all duration-200 ${
                                barber.profiles?.is_public
                                  ? 'bg-green-500 border-green-400 shadow-lg shadow-green-500/50' 
                                  : 'bg-red-500 border-red-400 shadow-lg shadow-red-500/50'
                              }`}
                            />
                          </div>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/20 text-white hover:bg-white/10"
                              onClick={() => setSelectedBarber(barber)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-darkpurple border-white/20 text-white max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="text-xl">User Details</DialogTitle>
                              <DialogDescription className="text-white/80">
                                Complete information for {barber.profiles?.name}
                              </DialogDescription>
                            </DialogHeader>
                            {selectedBarber && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-white/60">Name</p>
                                    <p className="font-semibold">{selectedBarber.profiles?.name}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-white/60">Email</p>
                                    <p className="font-semibold">{selectedBarber.profiles?.email}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-white/60">Phone</p>
                                    <p className="font-semibold">{selectedBarber.profiles?.phone || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-white/60">Location</p>
                                    <p className="font-semibold">{selectedBarber.profiles?.location || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-white/60">Role</p>
                                    <p className="font-semibold capitalize">{selectedBarber.profiles?.role}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-white/60">Status</p>
                                    <p className={`font-semibold ${selectedBarber.profiles?.is_disabled ? 'text-red-400' : 'text-green-400'}`}>
                                      {selectedBarber.profiles?.is_disabled ? 'Disabled' : 'Active'}
                                    </p>
                                  </div>
                                </div>
                                
                                {selectedBarber.profiles?.bio && (
                                  <div>
                                    <p className="text-sm text-white/60">Bio</p>
                                    <p className="text-sm">{selectedBarber.profiles.bio}</p>
                                  </div>
                                )}
                                
                                <div>
                                  <p className="text-sm text-white/60">Business Information</p>
                                  <p className="font-semibold">{selectedBarber.business_name || 'No business name'}</p>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4" />
                                    <span className="text-sm">Developer: {selectedBarber.is_developer ? 'Yes' : 'No'}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    <span className="text-sm">Joined: {new Date(selectedBarber.created_at).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Developers Tab */}
          <TabsContent value="developers" className="space-y-6">
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <Zap className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Developer Account Management</h3>
                  <p className="text-white/80">
                    Toggle developer mode to bypass Stripe fees and receive 100% of service revenue
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-500/20 border border-green-400/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span className="font-semibold text-green-300">Developer Mode</span>
                  </div>
                  <p className="text-green-200 text-sm">No platform fees • Full revenue • Special privileges</p>
                </div>
                <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <span className="font-semibold text-red-300">Regular Mode</span>
                  </div>
                  <p className="text-red-200 text-sm">$3.38 platform fee • 60% to BOCM • Standard features</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {filteredBarbers.map((barber) => (
                <Card key={barber.id} className={`transition-all duration-300 ${
                  barber.is_developer 
                    ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-400/50 shadow-lg shadow-green-500/20' 
                    : 'bg-white/10 border-white/20'
                } ${barber.profiles?.is_disabled ? 'opacity-50' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={barber.profiles?.avatar_url} />
                          <AvatarFallback className="bg-secondary text-white">
                            {barber.profiles?.name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-white">
                              {barber.profiles?.name || 'Unknown'}
                            </h3>
                            {barber.is_developer && (
                              <Badge className="bg-green-500 text-white font-bold px-3 py-1 text-sm shadow-lg">
                                DEVELOPER
                              </Badge>
                            )}
                          </div>
                          <p className="text-white/80 text-sm">{barber.profiles?.email}</p>
                          <p className="text-white/60 text-xs">
                            Business: {barber.business_name || 'No business name'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-white">Developer Mode</p>
                          <p className={`text-xs font-medium ${
                            barber.is_developer ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {barber.is_developer ? 'ENABLED' : 'DISABLED'}
                          </p>
                        </div>
                        
                        <Switch
                          checked={barber.is_developer}
                          onCheckedChange={() => toggleDeveloperStatus(barber.id, barber.is_developer)}
                          disabled={updatingBarber === barber.id || barber.profiles?.is_disabled}
                          className={`scale-150 transition-all duration-200 ${
                            barber.is_developer 
                              ? 'bg-green-500 border-green-400 shadow-lg shadow-green-500/50' 
                              : 'bg-red-500 border-red-400 shadow-lg shadow-red-500/50'
                          }`}
                        />
                        
                        {updatingBarber === barber.id && (
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-6">
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-yellow-500/20 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Review Moderation</h3>
                  <p className="text-white/80">
                    Manage and moderate user reviews to maintain platform quality
                  </p>
                </div>
              </div>
            </div>
            
            <div className="text-center py-12">
              <MessageSquare className="h-16 w-16 text-white/40 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Review Moderation</h3>
              <p className="text-white/60 mb-4">
                Access the comprehensive review moderation system
              </p>
              <Button 
                onClick={() => router.push('/admin')}
                className="bg-secondary text-primary hover:bg-secondary/90"
              >
                Go to Admin Dashboard
              </Button>
            </div>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white/10 border-white/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(systemStatus).map(([service, status]) => (
                    <div key={service} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          status === 'healthy' ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}>
                          {status === 'healthy' ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                        <span className="text-white font-medium capitalize">{service}</span>
                      </div>
                      <Badge className={
                        status === 'healthy' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      }>
                        {status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full bg-white/10 border border-white/20 hover:bg-white/20 text-white justify-start">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh System Status
                  </Button>
                  <Button className="w-full bg-white/10 border border-white/20 hover:bg-white/20 text-white justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    Export System Logs
                  </Button>
                  <Button className="w-full bg-white/10 border border-white/20 hover:bg-white/20 text-white justify-start">
                    <Archive className="h-4 w-4 mr-2" />
                    Backup Database
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Platform Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Developer Mode</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white/80">Enable Developer Accounts</span>
                        <Switch defaultChecked className="bg-green-500" />
                      </div>
                      <p className="text-sm text-white/60">
                        Allow barbers to bypass platform fees
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Account Management</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white/80">Allow Account Disabling</span>
                        <Switch defaultChecked className="bg-green-500" />
                      </div>
                      <p className="text-sm text-white/60">
                        Enable super admin to disable user accounts
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-white/20">
                  <h3 className="text-lg font-semibold text-white mb-4">Platform Statistics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                      <p className="text-sm text-white/60">Total Users</p>
                    </div>
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <p className="text-2xl font-bold text-white">{stats.totalBarbers}</p>
                      <p className="text-sm text-white/60">Barbers</p>
                    </div>
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <p className="text-2xl font-bold text-white">{stats.developers}</p>
                      <p className="text-sm text-white/60">Developers</p>
                    </div>
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <p className="text-2xl font-bold text-white">{stats.disabledAccounts}</p>
                      <p className="text-sm text-white/60">Disabled</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 