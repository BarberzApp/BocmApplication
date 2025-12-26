'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/shared/hooks/use-auth-zustand"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Checkbox } from "@/shared/components/ui/checkbox"
import { Scissors, User, Building2 } from "lucide-react"
import { useToast } from "@/shared/components/ui/use-toast"
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<"client" | "barber">("client")

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    agreeTerms: false,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      })
      return
    }

    if (!formData.agreeTerms) {
      toast({
        title: "Terms and conditions",
        description: "You must agree to the terms and conditions",
        variant: "destructive",
      })
      return
    }

    if (role === "barber" && !formData.businessName) {
      toast({
        title: "Business name required",
        description: "Please enter your business name",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const success = await register(
        formData.name,
        formData.email,
        formData.password,
        role,
        role === "barber" ? formData.businessName : undefined
      )

      if (success) {
        toast({
          title: "Registration successful",
          description: role === "barber" 
            ? "Welcome to BarberHub! Please complete your business profile setup."
            : "Welcome to BarberHub!",
        })
        const { push: safePush } = useSafeNavigation();
        safePush(role === "barber" ? "/barber/onboarding" : "/");
      }
    } catch (err) {
      setError('Failed to create account')
      toast({
        title: "Registration failed",
        description: err instanceof Error ? err.message : "An error occurred during registration",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)] py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create an Account</CardTitle>
          <CardDescription>Join BarberHub today</CardDescription>
        </CardHeader>

        <Tabs defaultValue="client" onValueChange={(value) => setRole(value as "client" | "barber")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="client" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Client
            </TabsTrigger>
            <TabsTrigger value="barber" className="flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              Barber
            </TabsTrigger>
          </TabsList>

          <TabsContent value="client">
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="John Doe"
                    required
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="client-terms"
                    name="agreeTerms"
                    checked={formData.agreeTerms}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, agreeTerms: checked as boolean }))}
                  />
                  <label
                    htmlFor="client-terms"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I agree to the{" "}
                    <Link href="/terms" className="text-primary hover:underline">
                      terms and conditions
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-primary hover:underline">
                      privacy policy
                    </Link>
                  </label>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
                <div className="mt-4 text-center text-sm">
                  Already have an account?{" "}
                  <Link href="/auth/login" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </div>
              </CardFooter>
            </form>
          </TabsContent>

          <TabsContent value="barber">
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="barber-name">Full Name</Label>
                  <Input
                    id="barber-name"
                    name="name"
                    placeholder="John Doe"
                    required
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barber-email">Email</Label>
                  <Input
                    id="barber-email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-name">Business Name</Label>
                  <Input
                    id="business-name"
                    name="businessName"
                    placeholder="Your Business Name"
                    required
                    value={formData.businessName}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barber-password">Password</Label>
                  <Input
                    id="barber-password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barber-confirm-password">Confirm Password</Label>
                  <Input
                    id="barber-confirm-password"
                    name="confirmPassword"
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="barber-terms"
                    name="agreeTerms"
                    checked={formData.agreeTerms}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, agreeTerms: checked as boolean }))}
                  />
                  <label
                    htmlFor="barber-terms"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I agree to the{" "}
                    <Link href="/terms" className="text-primary hover:underline">
                      terms and conditions
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-primary hover:underline">
                      privacy policy
                    </Link>
                  </label>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
                <div className="mt-4 text-center text-sm">
                  Already have an account?{" "}
                  <Link href="/auth/login" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </div>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
} 