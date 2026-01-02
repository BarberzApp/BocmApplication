'use client'

import { Input } from '@/shared/components/ui/input'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Instagram, Twitter, Facebook, Music } from 'lucide-react'
import { Control } from 'react-hook-form'

interface SocialMediaInputsProps {
  control: Control<any>
  instagram?: string
  twitter?: string
  tiktok?: string
  facebook?: string
}

export function SocialMediaInputs({ control }: SocialMediaInputsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FormField
        control={control}
        name="instagram"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2 text-white font-semibold">
              <Instagram className="h-4 w-4 text-[#E1306C]" />
              Instagram
            </FormLabel>
            <FormControl>
              <Input 
                placeholder="@yourusername" 
                {...field} 
                className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl" 
              />
            </FormControl>
            <FormDescription className="text-white/60">
              Only your handle (e.g., @yourusername)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="twitter"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2 text-white font-semibold">
              <Twitter className="h-4 w-4 text-[#1DA1F2]" />
              Twitter/X
            </FormLabel>
            <FormControl>
              <Input 
                placeholder="@yourusername" 
                {...field} 
                className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl" 
              />
            </FormControl>
            <FormDescription className="text-white/60">
              Only your handle (e.g., @yourusername)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="tiktok"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2 text-white font-semibold">
              <Music className="h-4 w-4 text-[#000000]" />
              TikTok
            </FormLabel>
            <FormControl>
              <Input 
                placeholder="@yourusername" 
                {...field} 
                className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl" 
              />
            </FormControl>
            <FormDescription className="text-white/60">
              Only your handle (e.g., @yourusername)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="facebook"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2 text-white font-semibold">
              <Facebook className="h-4 w-4 text-[#1877F3]" />
              Facebook
            </FormLabel>
            <FormControl>
              <Input 
                placeholder="yourpagename" 
                {...field} 
                className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl" 
              />
            </FormControl>
            <FormDescription className="text-white/60">
              Only your page name (e.g., yourpagename)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

