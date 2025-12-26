import React, { useState, useRef } from 'react'
import { Button } from '@/shared/components/ui/button'
import { X, Plus, GripVertical, Video, Image as ImageIcon, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/shared/components/ui/dialog'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/lib/utils'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { useToast } from '@/shared/components/ui/use-toast'
import { logger } from '@/shared/lib/logger'

// For drag-and-drop
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type PortfolioItem = {
  id: string
  type: 'image' | 'video'
  url: string
  file?: File
  created_at?: string
}

interface PortfolioEditorProps {
  initialItems: PortfolioItem[]
  open: boolean
  onClose: () => void
  onSave: (items: PortfolioItem[]) => void
}

export function PortfolioEditor({ initialItems, open, onClose, onSave }: PortfolioEditorProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<PortfolioItem[]>(initialItems)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Handle drag end
  const handleDragEnd = (event: any) => {
    const { active, over } = event
    if (active.id !== over.id) {
      const oldIndex = items.findIndex(i => i.id === active.id)
      const newIndex = items.findIndex(i => i.id === over.id)
      setItems(arrayMove(items, oldIndex, newIndex))
    }
  }

  // Handle remove
  const handleRemove = (id: string) => {
    setItems(items.filter(i => i.id !== id))
  }

  // Handle add media (upload immediately)
  const handleAddMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (items.length + files.length > 40) {
      setError('You can have up to 40 items in your portfolio.')
      return
    }

    if (!user) {
      setError('You must be logged in to upload media.')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      for (const file of files) {
        // Validate file type
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
          setError('Please select only image or video files.')
          continue
        }
        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          setError('File size must be less than 10MB.')
          continue
        }
        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/portfolio/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('portfolio')
          .upload(fileName, file)
        if (uploadError) {
          setError(`Failed to upload ${file.name}: ${uploadError.message}`)
          continue
        }
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('portfolio')
          .getPublicUrl(fileName)
        const type = file.type.startsWith('video/') ? 'video' : 'image'
        setItems(prev => ([
          ...prev,
          {
            id: `${Date.now()}-${file.name}`,
            type,
            url: publicUrl,
          }
        ]))
      }
    } catch (error) {
      logger.error('Error uploading media', error)
      setError('Failed to upload media. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  // Handle save (only update order/removals)
  const handleSave = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to save your portfolio.',
        variant: 'destructive',
      })
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      // Only update the barber profile with the current order/remaining items
      const uploadedUrls = items.map(item => item.url)
      const { error: updateError } = await supabase
        .from('barbers')
        .upsert({
          user_id: user.id,
          portfolio: uploadedUrls,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
      if (updateError) {
        throw new Error(`Failed to update portfolio: ${updateError.message}`)
      }
      onSave(items)
      toast({
        title: 'Success',
        description: 'Portfolio updated successfully!',
      })
      onClose()
    } catch (error) {
      logger.error('Error saving portfolio', error)
      setError(error instanceof Error ? error.message : 'Failed to save portfolio. Please try again.')
      toast({
        title: 'Error',
        description: 'Failed to save portfolio. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full bg-darkpurple/90 border border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bebas text-white">Edit Portfolio</DialogTitle>
          <DialogDescription className="text-white/80">
            Upload and organize your portfolio images and videos. Drag to reorder items.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleAddMedia}
                disabled={isUploading}
                aria-label="Add media to portfolio"
              />
              <Button
                type="button"
                disabled={isUploading}
                className="relative flex items-center gap-2 bg-gradient-to-br from-saffron/80 to-saffron/60 text-primary font-bold rounded-2xl px-6 py-3 shadow-xl hover:scale-105 hover:from-saffron hover:to-yellow-400 transition-all duration-200 border-0 focus:outline-none focus:ring-2 focus:ring-saffron focus:ring-offset-2 backdrop-blur-md"
                style={{ minHeight: 48, minWidth: 160 }}
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                {isUploading ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Uploading...</span>
                ) : (
                  <span className="flex items-center gap-2"><Plus className="h-6 w-6" /> Add Media</span>
                )}
              </Button>
            </div>
            <span className="text-xs text-white/80 font-medium">{items.length}/40 items</span>
          </div>
          {error && <div className="text-sm text-red-500 font-semibold">{error}</div>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {items.map((item, idx) => (
                  <SortablePortfolioItem
                    key={item.id}
                    id={item.id}
                    item={item}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
        <div className="flex justify-end gap-4 mt-8">
          <Button variant="outline" onClick={onClose} disabled={isSaving} className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl font-semibold px-6 py-2">Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-saffron text-primary font-semibold rounded-xl px-8 py-2 hover:bg-saffron/90">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Sortable item wrapper
function SortablePortfolioItem({ id, item, onRemove }: { id: string, item: PortfolioItem, onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.7 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group rounded-2xl overflow-hidden border-2 border-white/10 bg-primary/80 aspect-square flex items-center justify-center shadow-lg',
        isDragging && 'ring-2 ring-saffron'
      )}
      {...attributes} {...listeners}
    >
      {item.type === 'image' ? (
        <img src={item.url} alt="Portfolio" className="object-cover w-full h-full" />
      ) : (
        <video src={item.url} className="object-cover w-full h-full" controls={false} poster="" />
      )}
      <button
        className="absolute top-2 right-2 bg-white/90 hover:bg-saffron text-red-600 hover:text-primary rounded-full p-1.5 shadow-lg focus:outline-none border-2 border-white/40 transition-colors"
        onClick={() => onRemove(id)}
        aria-label="Remove"
        type="button"
      >
        <X className="h-5 w-5" />
      </button>
      <span className="absolute bottom-2 left-2 bg-white/80 rounded-lg px-2 py-1 text-xs flex items-center gap-1 shadow">
        <GripVertical className="h-3 w-3 text-muted-foreground" />
        {item.type === 'video' ? <Video className="h-3 w-3 text-blue-500" /> : <ImageIcon className="h-3 w-3 text-green-500" />}
      </span>
    </div>
  )
} 