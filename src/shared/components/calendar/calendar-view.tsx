"use client"

import * as React from "react"
import dynamic from 'next/dynamic'
import { Button } from "@/shared/components/ui/button"
import { format } from "date-fns"
import { useSafeNavigation } from "@/shared/hooks/use-safe-navigation"
import { Loader2 } from "lucide-react"
import { logger } from "@/shared/lib/logger"

const Calendar = dynamic(
  () => import("@/shared/components/ui/calendar").then((mod) => mod.Calendar),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    ),
  }
)

interface CalendarViewProps {
  events?: {
    id: string
    title: string
    date: Date
    bookingId?: string
  }[]
}

export function CalendarView({ events = [] }: CalendarViewProps) {
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const { push } = useSafeNavigation()

  const handleEventClick = (bookingId?: string) => {
    if (bookingId) {
      push(`/bookings/${bookingId}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Calendar</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          className="rounded-md border"
          modifiers={{
            hasEvent: (date) =>
              events.some(
                (event) =>
                  format(event.date, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
              ),
          }}
          modifiersStyles={{
            hasEvent: {
              backgroundColor: "hsl(var(--primary) / 0.1)",
              fontWeight: "bold",
            },
          }}
        />
        <div className="space-y-4">
          <h3 className="text-sm font-medium">
            {date ? format(date, "MMMM d, yyyy") : "Select a date"}
          </h3>
          <div className="space-y-2">
            {events
              .filter((event) =>
                date
                  ? format(event.date, "yyyy-MM-dd") ===
                    format(date, "yyyy-MM-dd")
                  : true
              )
              .map((event) => (
                <div
                  key={event.id}
                  className="cursor-pointer rounded-lg border p-3 hover:bg-accent"
                  onClick={() => handleEventClick(event.bookingId)}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{event.title}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        // Handle delete booking
                        logger.debug("Delete booking", { bookingId: event.bookingId })
                      }}
                    >
                      <span className="sr-only">Delete booking</span>
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            {events.filter(
              (event) =>
                date &&
                format(event.date, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
            ).length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                No bookings for this day
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 