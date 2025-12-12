'use client';
import Link from 'next/link';
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/shared/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { 
  Scissors, 
  Calendar, 
  DollarSign, 
  Users, 
  Star, 
  TrendingUp, 
  CheckCircle,
  ArrowRight,
  Play,
  Quote,
  Award,
  Zap,
  Menu,
  X,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  MapPin,
  Sparkles,
  Video,
  Instagram,
  Clock,
  User
} from 'lucide-react';

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [averageMonthlyAmount, setAverageMonthlyAmount] = useState("5000");
  const [cutCost, setCutCost] = useState("50");
  const [numberOfCuts, setNumberOfCuts] = useState(100);
  const [platformFeeBonus, setPlatformFeeBonus] = useState(120); // $1.20 per cut (40% of $3.00 after Stripe fee)
  const [extraAnnual, setExtraAnnual] = useState(1620);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [headerState, setHeaderState] = useState<'default' | 'scrolled' | 'hidden'>('default');

  const updateCalculator = () => {
    const monthlyAmount = parseFloat(averageMonthlyAmount) || 5000;
    const servicePrice = parseFloat(cutCost) || 50;
    const cuts = Math.round(monthlyAmount / servicePrice);
    // Barber gets $1.20 per booking (40% of $3.00 after Stripe fee)
    const bonus = cuts * 1.20;
    const annual = bonus * 12;
    setNumberOfCuts(cuts);
    setPlatformFeeBonus(bonus);
    setExtraAnnual(annual);
  };

  useEffect(() => {
    updateCalculator();
  }, [averageMonthlyAmount, cutCost]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200 ) {
        setHeaderState('hidden');
      } else if (window.scrollY > 0) {
        setHeaderState('scrolled');
      } else {
        setHeaderState('default');
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSubmitted(false);
    try {
      const res = await fetch("/api/send-booking-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed to send email");
      setSubmitted(true);
      setEmail("");
    } catch (err) {
      setError("Failed to send. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const testimonials = [
    {
      name: "Chance Robenson",
      role: "Barber",
      location: "Princeton, NJ",
      revenue: "$50K/year",
      image: "/api/placeholder/60/60",
      quote: "BOCM made running my business so much easier. My clients love the booking experience, and I've seen my revenue grow every month.",
      rating: 5
    },
    {
      name: "Caleb Bock",
      role: "Barber",
      location: "Blacksburg, VA",
      revenue: "$65K/year",
      image: "/api/placeholder/60/60",
      quote: "Since switching to BOCM, I spend less time on admin and more time with my clients. The reminders and scheduling are a game changer!",
      rating: 5
    }
  ];

  const features = [
    {
      number: "01",
      title: "Social Media Integration",
      description: "Connect your Instagram, Twitter, and Facebook to showcase your best cuts, share your portfolio, and attract new clients directly from your profile.",
      icon: Star,
      color: "bg-secondary/20 text-secondary"
    },
    {
      number: "02", 
      title: "Revenue Optimization",
      description: "Boost your earnings with smart pricing, service add-ons, and analytics that help you maximize every booking.",
      icon: DollarSign,
      color: "bg-secondary/20 text-secondary"
    },
    {
      number: "03",
      title: "Reach System",
      description: "Get discovered by clients through our on-demand marketplace—customers browse, book, and you get paid for every service delivered.",
      icon: Zap,
      color: "bg-secondary/20 text-secondary",
      beta: true
    },
    {
      number: "04",
      title: "Client Management",
      description: "Easily manage client profiles, preferences, and booking history to deliver a personalized experience every time.",
      icon: Users,
      color: "bg-secondary/20 text-secondary"
    }
  ];

  const mobileNavItems = [
    { href: "#features", label: "Features" },
    { href: "#testimonials", label: "Success Stories" },
    { href: "#calculator", label: "Calculator" },
    { href: "/browse", label: "Browse" },
    { href: "/login", label: "Login" },
    { href: "/register", label: "Get Started" },
  ];

  // Mock data for reels showcase
  const showcaseCuts = [
    {
      id: "1",
      title: "Fade Masterpiece",
      barber: "Chance Robenson",
      views: "2.4K",
      likes: "156",
      comments: "23",
      category: "Fade",
      price: "$45",
      location: "Princeton, NJ"
    },
    {
      id: "2",
      title: "Classic Taper",
      barber: "Caleb Bock",
      views: "1.8K",
      likes: "120",
      comments: "15",
      category: "Taper",
      price: "$40",
      location: "Blacksburg, VA"
    }
  ];



  return (
    <>
    <div className="landing-root min-h-screen bg-background">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      {/* Header with Mobile Menu */}
      <header
          className={`w-full py-3 sm:py-6 px-4 sm:px-6 bg-background backdrop-blur-xl transition-transform duration-300 ease-in-out z-50 fixed top-0
          ${headerState === 'default' ? 'translate-y-0' : ''}
          ${headerState === 'scrolled' ? 'translate-y-2 shadow-lg' : ''}
          ${headerState === 'hidden' ? '-translate-y-full' : ''}
        `}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center w-full md:w-auto justify-between md:justify-start">
              <Link href="/" className="flex items-center gap-2 text-xl sm:text-2xl font-bebas font-bold text-secondary">
              <img src="/BocmLogo.png" alt="BOCM Logo" className="h-8 w-8 sm:h-10 sm:w-10" />
                <span className="font-bebas text-2xl font-bold text-secondary ml-2">BOCM</span>
            </Link>
            <div className="md:hidden flex items-center">
              <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 text-white hover:bg-white/10"
                  >
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Toggle Menu</span>
                  </Button>
                </SheetTrigger>
                  <SheetContent side="right" className="w-[300px] bg-background backdrop-blur-xl border-white/10">
                  <div className="flex flex-col h-full">
                      <div className="flex items-center justify-center mb-8">
                        <span className="flex items-center gap-2 text-2xl font-bebas font-bold text-secondary">
                        <img src="/BocmLogo.png" alt="BOCM Logo" className="h-8 w-8 sm:h-10 sm:w-10" />
                        BOCM
                      </span>
                    </div>
                    <nav className="flex-1">
                      <ul className="space-y-4">
                        {mobileNavItems.map((item) => (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setIsMenuOpen(false)}
                                className="block py-3 px-4 text-white hover:text-secondary hover:bg-white/10 rounded-lg transition-colors text-lg font-bebas font-medium"
                            >
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-white hover:text-secondary transition-colors font-medium">
              Features
            </Link>
            <Link href="#testimonials" className="text-white hover:text-secondary transition-colors font-medium">
              Success Stories
            </Link>
            <Link href="#calculator" className="text-white hover:text-secondary transition-colors font-medium">
              Calculator
            </Link>
            <Link href="/browse" className="text-white hover:text-secondary transition-colors font-medium">
              Browse
            </Link>
            <Link href="/login" className="text-white hover:text-secondary transition-colors font-medium">
              Login
            </Link>
            <Link href="/register" className="bg-secondary text-black px-6 py-2 rounded-xl font-semibold hover:bg-secondary/90 transition-colors">
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
        <section className="pt-24 sm:pt-32 pb-16 sm:pb-24 relative animate-fade-in">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Column - Content */}
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Badge className="bg-secondary/20 text-secondary border-secondary/30 px-3 py-1">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Social Booking Platform
                  </Badge>
                </div>
                
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bebas font-bold text-white leading-tight">
                  The Future of
                    <span className="text-secondary block font-bebas">Cosmetology Booking</span>
                </h1>
                
                <p className="text-lg sm:text-xl text-white/80 leading-relaxed max-w-2xl">
                    <span className="font-pacifico">Connect, showcase, and grow.</span> BOCM is the first social booking platform that lets cosmetologists share their work, build their brand, and book clients seamlessly.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/register" className="bg-secondary text-black px-8 py-4 rounded-xl font-semibold text-lg hover:bg-secondary/90 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-secondary/25">
                  Start Your Journey
                  <ArrowRight className="inline ml-2 h-5 w-5" />
                </Link>
                <Link href="/cuts" className="flex items-center justify-center px-8 py-4 border border-white/20 text-white rounded-xl font-semibold text-lg hover:bg-white/10 transition-all duration-300">
                  <Play className="inline w-5 h-5 mr-2" />
                  Watch Real Results
                </Link>
              </div>

              {/* Why Choose BOCM */}
              <div className="space-y-4 pt-6 sm:pt-8">
                <h3 className="text-lg sm:text-xl font-bold text-white text-center mb-4">Why Choose BOCM?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2 sm:py-3">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-secondary mr-2 sm:mr-3 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-white/90 font-medium">Zero Setup Fees</span>
                  </div>
                  <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2 sm:py-3">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-secondary mr-2 sm:mr-3 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-white/90 font-medium">Instant Payments</span>
                </div>
                  <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2 sm:py-3">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-secondary mr-2 sm:mr-3 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-white/90 font-medium">Social Growth</span>
                </div>
                </div>
              </div>
            </div>

            {/* Right Column - Dashboard Demo */}
            <div className="relative mt-8 lg:mt-0">
              <Card className="bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl p-6 sm:p-8">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg sm:text-xl font-bold text-white">Revenue Dashboard</CardTitle>
                    <div className="flex items-center text-secondary">
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      <span className="text-sm font-medium">+40%</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white/10 rounded-xl p-3 sm:p-4">
                      <p className="text-white/60 text-xs sm:text-sm">Monthly Revenue</p>
                      <p className="text-lg sm:text-2xl font-bold text-white">$12,450</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 sm:p-4">
                      <p className="text-white/60 text-xs sm:text-sm">Bookings</p>
                      <p className="text-lg sm:text-2xl font-bold text-white">127</p>
                    </div>
                  </div>
                  
                  <div className="bg-secondary/20 rounded-xl p-3 sm:p-4">
                    <p className="text-secondary text-xs sm:text-sm font-medium">This Month's Growth</p>
                    <p className="text-lg sm:text-xl font-bold text-secondary">+$3,200</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Reels Showcase Section */}
        <section className="py-16 sm:py-20 bg-background backdrop-blur-sm animate-fade-in">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bebas font-bold text-white mb-4">
              Showcase Your Work
            </h2>
            <p className="text-lg sm:text-xl text-white/80 max-w-3xl mx-auto">
              Share your best cuts, build your brand, and attract new clients with our social-first video platform.
            </p>
          </div>

          {/* Reels Grid */}
            <div className="flex justify-center w-full">
              <div className="grid grid-cols-2 gap-6 sm:gap-8 max-w-4xl w-full">
            {showcaseCuts.map((cut, index) => (
                  <Link key={cut.id} href="/cuts">
              <Card
                key={cut.id}
                className={
                  showcaseCuts.length === 1
                    ? 'md:col-start-2 group bg-white/5 border border-white/10 shadow-xl backdrop-blur-xl rounded-2xl overflow-hidden hover:shadow-2xl hover:border-secondary/30 transition-all duration-300 hover:-translate-y-2'
                    : 'group bg-white/5 border border-white/10 shadow-xl backdrop-blur-xl rounded-2xl overflow-hidden hover:shadow-2xl hover:border-secondary/30 transition-all duration-300 hover:-translate-y-2'
                }
              >
                <CardContent className="p-0">
                  {/* Video Placeholder */}
                  <div className="relative aspect-[9/16] bg-gradient-to-br from-secondary/20 via-purple-500/20 to-secondary/20 overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-black/30 rounded-full p-4 backdrop-blur-sm">
                        <Play className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="absolute right-3 bottom-20 flex flex-col gap-4">
                      <button className="flex flex-col items-center">
                        <div className="bg-black/30 rounded-full p-2 mb-1 backdrop-blur-sm">
                          <Heart className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-white text-xs font-medium">{cut.likes}</span>
                      </button>
                      <button className="flex flex-col items-center">
                        <div className="bg-black/30 rounded-full p-2 mb-1 backdrop-blur-sm">
                          <MessageCircle className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-white text-xs font-medium">{cut.comments}</span>
                      </button>
                      <button className="flex flex-col items-center">
                        <div className="bg-black/30 rounded-full p-2 mb-1 backdrop-blur-sm">
                          <Share2 className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-white text-xs font-medium">Share</span>
                      </button>
                    </div>

                    {/* Bottom Info */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
                      <div className="flex items-center mb-2">
                        <div className="h-8 w-8 border-2 border-white rounded-full mr-3 bg-secondary/20 flex items-center justify-center">
                          <User className="h-4 w-4 text-secondary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm truncate">@{cut.barber.toLowerCase().replace(/\s+/g, '')}</p>
                          <p className="text-white/70 text-xs truncate">{cut.barber}</p>
                        </div>
                      </div>
                      <p className="text-white text-sm mb-2 line-clamp-2">{cut.title}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-white/10 text-white border-0 text-xs">
                            {cut.category}
                          </Badge>
                          <div className="flex items-center text-white/70 text-xs">
                            <Eye className="h-3 w-3 mr-1" />
                            {cut.views}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-xs">
                            {cut.price}
                          </Badge>
                          <div className="flex items-center text-white/70 text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            {cut.location}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
                  </Link>
            ))}
              </div>
          </div>

          <div className="text-center mt-12">
            <Link href="/login" className="inline-flex items-center bg-secondary text-black px-8 py-4 rounded-xl font-semibold text-lg hover:bg-secondary/90 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-secondary/25">
              <Video className="mr-2 h-5 w-5" />
              Explore All Cuts
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Revenue Calculator Section */}
        <section id="calculator" className="py-16 sm:py-20 bg-background backdrop-blur-sm animate-fade-in">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bebas font-bold text-white mb-4">
              The "Holy Sh*t" Moment
            </h2>
            <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto">
              See exactly how much more you could be earning with BOCM's revenue optimization tools.
            </p>
          </div>

          <Card className="bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl p-6 sm:p-8 lg:p-12">
            <CardContent className="grid lg:grid-cols-2 gap-6 sm:gap-8 items-start">
              {/* Calculator Input */}
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-white font-semibold mb-2 text-sm sm:text-base">
                      Average Monthly Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-white/60">$</span>
                      <input
                        type="text"
                        value={averageMonthlyAmount}
                        onChange={(e) => setAverageMonthlyAmount(e.target.value.replace(/[^\d]/g, ''))}
                        className="w-full pl-6 sm:pl-8 pr-3 sm:pr-4 py-3 sm:py-4 bg-white/10 border border-white/20 rounded-xl text-white text-lg sm:text-xl font-semibold placeholder-white/40 focus:outline-none focus:border-secondary"
                        placeholder="5000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-white font-semibold mb-2 text-sm sm:text-base">
                      Cut Cost
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-white/60">$</span>
                      <input
                        type="text"
                        value={cutCost}
                        onChange={(e) => setCutCost(e.target.value.replace(/[^\d]/g, ''))}
                        className="w-full pl-6 sm:pl-8 pr-3 sm:pr-4 py-3 sm:py-4 bg-white/10 border border-white/20 rounded-xl text-white text-lg sm:text-xl font-semibold placeholder-white/40 focus:outline-none focus:border-secondary"
                        placeholder="50"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 sm:mt-8 text-center">
                  <div className="text-base sm:text-lg text-white/80 mb-2">You do <span className="font-bold text-secondary">{numberOfCuts}</span> cuts per month</div>
                  <div className="text-xl sm:text-2xl font-bold text-secondary mb-2">Platform Fee Bonus: ${platformFeeBonus.toLocaleString(undefined, {maximumFractionDigits: 0})}/month</div>
                  <div className="text-base sm:text-lg text-white/80 mb-4">That's <span className="font-bold text-secondary">${extraAnnual.toLocaleString(undefined, {maximumFractionDigits: 0})}</span> per year in extra income!</div>
                  <div className="bg-secondary/20 rounded-2xl p-4 sm:p-6 border border-secondary/30 inline-block mt-4">
                    <div className="text-white/80 text-xs sm:text-sm mb-1">Breakdown:</div>
                    <div className="text-white text-sm sm:text-base font-semibold">{numberOfCuts} cuts × $1.20 = <span className="text-secondary">${platformFeeBonus.toLocaleString(undefined, {maximumFractionDigits: 0})}</span> per month</div>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-secondary/20 rounded-2xl p-4 sm:p-6 border border-secondary/30">
                  <p className="text-secondary text-xs sm:text-sm font-medium mb-2">Total Monthly Revenue</p>
                  <p className="text-3xl sm:text-4xl font-bold text-secondary">${platformFeeBonus.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                  <p className="text-secondary/80 text-xs sm:text-sm mt-1">Service + Platform Fees (40%)</p>
                </div>
                
                <div className="bg-white/10 rounded-2xl p-4 sm:p-6">
                  <p className="text-white/60 text-xs sm:text-sm mb-2">Extra Annual Income</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white">${extraAnnual.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                  <p className="text-white/60 text-xs sm:text-sm mt-1">From platform fees alone</p>
                </div>
                
                <div className="bg-secondary/20 rounded-2xl p-4 sm:p-6 border border-secondary/30">
                  <p className="text-secondary text-xs sm:text-sm font-medium mb-2">Monthly Breakdown</p>
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/60">Number of Cuts:</span>
                      <span className="text-white">{numberOfCuts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Platform Fee Bonus:</span>
                      <span className="text-white">${platformFeeBonus.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>
                  </div>
                </div>
                
                <button className="w-full px-6 sm:px-8 py-3 sm:py-4 bg-secondary text-black rounded-xl font-semibold text-base sm:text-lg hover:bg-secondary/90 transition-colors">
                  Start Earning More Today
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Section */}
        <section id="features" className="py-16 sm:py-20 animate-fade-in">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              Everything You Need to Scale
            </h2>
            <p className="text-lg sm:text-xl text-white/80 max-w-3xl mx-auto">
              From booking automation to revenue optimization, BOCM gives you the tools to transform your cosmetology business.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className="group bg-white/5 border border-white/10 shadow-xl backdrop-blur-xl rounded-2xl p-5 sm:p-6 hover:shadow-2xl hover:border-secondary/30 transition-all duration-300 hover:-translate-y-2 relative overflow-hidden"
              >
                <CardContent className="p-0">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${feature.color}`}>
                    <feature.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-3xl sm:text-4xl text-white/20 group-hover:text-white/30 transition-colors">
                    {feature.number}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg sm:text-xl font-semibold text-white mb-0">{feature.title}</h3>
                  {feature.beta && (
                      <Badge className="bg-gradient-to-r from-secondary/80 to-secondary/80 text-white border-secondary/40 animate-pulse">
                      Beta
                      </Badge>
                  )}
                </div>
                <p className="text-white/70 leading-relaxed text-sm sm:text-base">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
        <section id="testimonials" className="py-16 sm:py-20 bg-background backdrop-blur-sm animate-fade-in">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              Success Stories
            </h2>
            <p className="text-lg sm:text-xl text-white/80 max-w-3xl mx-auto">
              See how cosmetologists are transforming their businesses with BOCM.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-white/5 border border-white/10 shadow-xl backdrop-blur-xl rounded-2xl p-6 sm:p-8">
                <CardContent className="p-0">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="h-12 w-12 bg-secondary/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="h-6 w-6 text-secondary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">{testimonial.name}</h3>
                      <p className="text-white/70 text-sm">{testimonial.role} • {testimonial.location}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-secondary font-semibold">{testimonial.revenue}</span>
                        <div className="flex items-center">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <Star key={i} className="h-4 w-4 text-secondary fill-current" />
                          ))}
                        </div>
                      </div>
                  </div>
                  </div>
                  <blockquote className="text-white/80 text-base leading-relaxed italic">
                  "{testimonial.quote}"
                </blockquote>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
        <section className="py-16 sm:py-20 animate-fade-in">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <Card className="bg-gradient-to-br from-secondary/20 via-secondary/10 to-transparent border border-secondary/30 shadow-2xl backdrop-blur-xl rounded-3xl p-8 sm:p-12">
            <CardContent className="p-0">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
                Ready to Transform Your Business?
            </h2>
              <p className="text-lg sm:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
                Join cosmetologists who are already growing their business with BOCM. Start your journey today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register" className="bg-secondary text-black px-8 py-4 rounded-xl font-semibold text-lg hover:bg-secondary/90 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-secondary/25">
                  Get Started Free
                  <ArrowRight className="inline ml-2 h-5 w-5" />
                </Link>
                <Link href="/browse" className="flex items-center justify-center px-8 py-4 border border-white/20 text-white rounded-xl font-semibold text-lg hover:bg-white/10 transition-all duration-300">
                  Browse Stylists
              </Link>
            </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-white/5 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center space-y-6">
            {/* Support Button */}
            <div className="flex justify-center">
              <Link href="/support">
                <Button className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:border-secondary/30 transition-all duration-300 rounded-xl px-6 py-3 font-semibold">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Need Help? Contact Support
                </Button>
              </Link>
            </div>
            
            <p className="text-white/60 text-sm">
              © 2025 BOCM. All rights reserved. The future of booking.
            </p>
          </div>
        </div>
      </footer>

      {/* Email Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-black/95 border border-white/20 backdrop-blur-xl rounded-2xl">
          <DialogDescription className="text-white/80">
            {submitted ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-secondary mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Thank you!</h3>
                <p className="text-white/70">We'll be in touch soon with exclusive early access.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white">Get Early Access</h3>
                <p className="text-white/70">Be among the first to experience the future of Cosmetology booking.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-secondary"
                  required
                />
                  {error && <p className="text-red-400 text-sm">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-secondary text-black py-3 rounded-xl font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Get Early Access"}
                  </button>
                </form>
                </div>
            )}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
} 