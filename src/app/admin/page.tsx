"use client";

import { useState, useEffect } from "react";
import { AdminRouteGuard } from "@/shared/components/admin/AdminRouteGuard";
import { ReviewModeration } from "@/shared/components/admin/ReviewModeration";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { 
  MessageSquare, 
  Users, 
  BarChart3, 
  Settings, 
  Shield,
  Star,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  UserCheck,
  UserX,
  Activity,
  Zap,
  Crown,
  Database,
  Globe,
  Bell
} from "lucide-react";
import { useAdminAuth } from "@/shared/hooks/useAdminAuth";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBarbers: 0,
    totalBookings: 0,
    totalRevenue: 0,
    pendingReviews: 0,
    activeBookings: 0,
    newUsersToday: 0,
    revenueToday: 0
  });
  const [loading, setLoading] = useState(true);
  const { adminUser, isSuperAdmin } = useAdminAuth();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // Simulate fetching real stats - replace with actual API calls
      const mockStats = {
        totalUsers: 1247,
        totalBarbers: 89,
        totalBookings: 3456,
        totalRevenue: 125000,
        pendingReviews: 12,
        activeBookings: 156,
        newUsersToday: 23,
        revenueToday: 2456
      };
      setStats(mockStats);
    } catch (error) {
      logger.error('Error fetching stats', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const StatCard = ({ title, value, icon: Icon, color, trend, subtitle }: any) => (
    <Card className="bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-white/60 text-sm font-medium">{title}</p>
            <p className="text-white font-bold text-2xl mt-2">{value}</p>
            {subtitle && <p className="text-white/40 text-xs mt-1">{subtitle}</p>}
            {trend && (
              <div className="flex items-center mt-2">
                <TrendingUp className={`w-4 h-4 ${trend > 0 ? 'text-green-400' : 'text-red-400'}`} />
                <span className={`text-xs ml-1 ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {trend > 0 ? '+' : ''}{trend}% from last week
                </span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const QuickActionCard = ({ title, description, icon: Icon, action, color }: any) => (
    <Card className="bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer group">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${color} group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg">{title}</h3>
            <p className="text-white/60 text-sm mt-1">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminRouteGuard hideHeader={true}>
      <div className="space-y-8">
        {/* Enhanced Header */}
        <div className="bg-gradient-to-r from-black/95 to-black/80 border-b border-white/20 backdrop-blur-xl rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-secondary to-secondary/80 rounded-xl">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                  Super Admin Dashboard
                  {isSuperAdmin && (
                    <Badge variant="secondary" className="text-xs">
                      SUPER ADMIN
                    </Badge>
                  )}
                </h1>
                <p className="text-white/60 mt-1">
                  Welcome back, {adminUser?.name}! Manage your barber platform with full control.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-white/60 text-sm">Logged in as</p>
                <p className="text-white font-medium">{adminUser?.email}</p>
              </div>
              <Avatar className="w-10 h-10">
                <AvatarImage src={adminUser?.avatar_url} />
                <AvatarFallback className="bg-secondary text-white">
                  {adminUser?.name?.charAt(0) || 'A'}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Users"
            value={stats.totalUsers.toLocaleString()}
            icon={Users}
            color="bg-blue-500/20"
            trend={12}
            subtitle="Active platform users"
          />
          <StatCard
            title="Total Barbers"
            value={stats.totalBarbers}
            icon={UserCheck}
            color="bg-green-500/20"
            trend={8}
            subtitle="Registered barbers"
          />
          <StatCard
            title="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            icon={DollarSign}
            color="bg-purple-500/20"
            trend={15}
            subtitle="All-time platform revenue"
          />
          <StatCard
            title="Pending Reviews"
            value={stats.pendingReviews}
            icon={MessageSquare}
            color="bg-yellow-500/20"
            trend={-5}
            subtitle="Awaiting moderation"
          />
        </div>

        {/* Today's Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard
            title="Today's Bookings"
            value={stats.activeBookings}
            icon={Calendar}
            color="bg-indigo-500/20"
            subtitle="Active appointments today"
          />
          <StatCard
            title="Today's Revenue"
            value={formatCurrency(stats.revenueToday)}
            icon={TrendingUp}
            color="bg-emerald-500/20"
            subtitle="Revenue generated today"
          />
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-white/5 border border-white/10 p-1 rounded-xl">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-secondary data-[state=active]:text-primary rounded-lg"
            >
              <Activity className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="reviews" 
              className="data-[state=active]:bg-secondary data-[state=active]:text-primary rounded-lg"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Reviews
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className="data-[state=active]:bg-secondary data-[state=active]:text-primary rounded-lg"
            >
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="data-[state=active]:bg-secondary data-[state=active]:text-primary rounded-lg"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="data-[state=active]:bg-secondary data-[state=active]:text-primary rounded-lg"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <QuickActionCard
                title="Moderate Reviews"
                description="Review and approve pending customer reviews"
                icon={MessageSquare}
                color="bg-yellow-500/20"
                action={() => setActiveTab("reviews")}
              />
              <QuickActionCard
                title="User Management"
                description="Manage user accounts and permissions"
                icon={Users}
                color="bg-blue-500/20"
                action={() => setActiveTab("users")}
              />
              <QuickActionCard
                title="Platform Analytics"
                description="View detailed platform performance metrics"
                icon={BarChart3}
                color="bg-purple-500/20"
                action={() => setActiveTab("analytics")}
              />
            </div>

            {/* Recent Activity */}
            <Card className="bg-white/5 border border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">New barber registration</p>
                      <p className="text-white/60 text-sm">John Doe joined as a barber</p>
                    </div>
                    <span className="text-white/40 text-xs">2 min ago</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Calendar className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">Booking completed</p>
                      <p className="text-white/60 text-sm">Appointment #1234 marked as completed</p>
                    </div>
                    <span className="text-white/40 text-xs">15 min ago</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">Review flagged</p>
                      <p className="text-white/60 text-sm">New review requires moderation</p>
                    </div>
                    <span className="text-white/40 text-xs">1 hour ago</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4">
            <ReviewModeration />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card className="bg-white/5 border border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  User Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <QuickActionCard
                    title="Manage Barbers"
                    description="View and manage barber accounts"
                    icon={UserCheck}
                    color="bg-green-500/20"
                  />
                  <QuickActionCard
                    title="Client Accounts"
                    description="Manage client user accounts"
                    icon={Users}
                    color="bg-blue-500/20"
                  />
                  <QuickActionCard
                    title="Admin Users"
                    description="Manage admin and super admin accounts"
                    icon={Shield}
                    color="bg-purple-500/20"
                  />
                </div>
                <p className="text-white/60 mt-6 text-center">
                  User management features coming soon. This will include account management, 
                  role assignments, user activity monitoring, and account suspension capabilities.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card className="bg-white/5 border border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Analytics Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <QuickActionCard
                    title="Booking Analytics"
                    description="View booking trends and patterns"
                    icon={Calendar}
                    color="bg-indigo-500/20"
                  />
                  <QuickActionCard
                    title="Revenue Reports"
                    description="Detailed revenue and financial analytics"
                    icon={DollarSign}
                    color="bg-emerald-500/20"
                  />
                  <QuickActionCard
                    title="User Growth"
                    description="Track user acquisition and retention"
                    icon={TrendingUp}
                    color="bg-blue-500/20"
                  />
                </div>
                <p className="text-white/60 mt-6 text-center">
                  Analytics dashboard coming soon. This will include booking trends, revenue analytics, 
                  user growth metrics, performance insights, and customizable reports.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card className="bg-white/5 border border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Admin Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <QuickActionCard
                    title="Platform Settings"
                    description="Configure platform-wide settings"
                    icon={Globe}
                    color="bg-blue-500/20"
                  />
                  <QuickActionCard
                    title="Content Moderation"
                    description="Configure review and content moderation rules"
                    icon={Shield}
                    color="bg-yellow-500/20"
                  />
                  <QuickActionCard
                    title="Database Management"
                    description="Manage database and system settings"
                    icon={Database}
                    color="bg-purple-500/20"
                  />
                </div>
                <p className="text-white/60 mt-6 text-center">
                  Admin settings coming soon. This will include platform configuration, 
                  content moderation settings, system preferences, and advanced admin controls.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminRouteGuard>
  );
} 