"use client"

import { useState } from "react"
import { useAuth } from "@/shared/hooks/use-auth-zustand"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group"
import { useToast } from "@/shared/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'

export function SignupForm() {
  const { register } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const { push: safePush } = useSafeNavigation();
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"client" | "barber">("client")
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const success = await register(name, email, password, role)
      if (success) {
        setShowConfirmation(true)
      }
    } catch (error) {
      logger.error('Signup error', error)
      toast({
        title: "Signup failed",
        description: error instanceof Error ? error.message : "Failed to create account. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (showConfirmation) {
    return (
      <div className="space-y-4 text-center">
        <h3 className="text-lg font-medium">Check your email</h3>
        <p className="text-muted-foreground">
          We've sent you a confirmation email. Please check your inbox and follow the instructions to complete your
          registration.
        </p>
        <Button variant="outline" onClick={() => safePush("/login")}>
          Return to login
        </Button>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="John Doe"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </div>

        <div className="space-y-2">
          <Label>I am a</Label>
          <RadioGroup
            value={role}
            onValueChange={(value) => setRole(value as "client" | "barber")}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="client" id="client" />
              <Label htmlFor="client">Client</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="barber" id="barber" />
              <Label htmlFor="barber">Barber</Label>
            </div>
          </RadioGroup>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </>
  )
} 