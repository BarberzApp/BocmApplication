import React, { useState, useRef, useCallback } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { Progress } from '@/shared/components/ui/progress'
import { useToast } from '@/shared/components/ui/use-toast'
import { 
  Upload, 
  Video, 
  Image, 
  X, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  Loader2,
  CheckCircle,
  AlertCircle,
  Settings,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  compressVideo, 
  generateThumbnail, 
  validateVideoFile, 
  formatFileSize, 
  formatDuration,
  isVideoCompressionSupported,
  type CompressionOptions,
  type CompressionResult
} from '@/shared/utils/video-compression'

interface VideoUploadProps {
  onUpload: (data: {
    file: File
    title: string
    description?: string
    category: string
    tags: string[]
    thumbnail?: string
    duration: number
    width: number
    height: number
  }) => Promise<void>
  maxFileSize?: number
  allowedFormats?: string[]
  className?: string
}

const categories = [
  { value: 'fade-cuts', label: 'Fade Cuts' },
  { value: 'beard-trims', label: 'Beard Trims' },
  { value: 'hair-styling', label: 'Hair Styling' },
  { value: 'color-work', label: 'Color Work' },
  { value: 'specialty-cuts', label: 'Specialty Cuts' },
  { value: 'behind-scenes', label: 'Behind Scenes' },
  { value: 'tutorials', label: 'Tutorials' },
  { value: 'before-after', label: 'Before & After' }
]

export function VideoUpload({ 
  onUpload, 
  maxFileSize = 270 * 1024 * 1024, // 270MB
  allowedFormats = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  className 
}: VideoUploadProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('hair-styling')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [thumbnail, setThumbnail] = useState<string>('')
  const [thumbnailTime, setThumbnailTime] = useState(1)
  
  const [uploading, setUploading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  const [videoMetadata, setVideoMetadata] = useState<{
    duration: number
    width: number
    height: number
    size: number
  } | null>(null)
  
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null)
  const [compressionOptions, setCompressionOptions] = useState<CompressionOptions>({
    maxWidth: 1280,
    maxHeight: 720,
    maxBitrate: 2000000,
    maxDuration: 60,
    quality: 0.8,
    format: 'mp4'
  })
  const [showCompressionSettings, setShowCompressionSettings] = useState(false)

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setError(null)
    setProgress(0)
    
    // Validate file
    const validation = validateVideoFile(selectedFile)
    if (!validation.isValid) {
      setError(validation.errors[0])
      return
    }

    setFile(selectedFile)
    
    try {
      // Get video metadata
      const video = document.createElement('video')
      video.onloadedmetadata = () => {
        const metadata = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          size: selectedFile.size
        }
        setVideoMetadata(metadata)
        
        // Auto-generate title from filename
        const fileName = selectedFile.name.replace(/\.[^/.]+$/, '')
        setTitle(fileName)
        
        // Auto-generate thumbnail
        generateThumbnail(selectedFile, thumbnailTime).then(setThumbnail)
      }
      video.src = URL.createObjectURL(selectedFile)
    } catch (error) {
      logger.error('Error getting video metadata', error)
      setError('Failed to read video metadata')
    }
  }, [thumbnailTime])

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      handleFileSelect(files[0])
    }
  }

  // Compress video
  const handleCompress = useCallback(async () => {
    if (!file || !isVideoCompressionSupported()) return

    setCompressing(true)
    setProgress(0)
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const result = await compressVideo(file, compressionOptions)
      
      clearInterval(progressInterval)
      setProgress(100)
      setCompressionResult(result)
      
      toast({
        title: 'Compression Complete',
        description: `Reduced file size by ${result.compressionRatio.toFixed(1)}%`,
      })
    } catch (error) {
      logger.error('Compression error', error)
      setError('Failed to compress video')
      toast({
        title: 'Compression Failed',
        description: 'Failed to compress video. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setCompressing(false)
    }
  }, [file, compressionOptions, toast])

  // Add tag
  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag])
      setTagInput('')
    }
  }

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  // Generate new thumbnail
  const handleGenerateThumbnail = async () => {
    if (!file) return
    
    try {
      const newThumbnail = await generateThumbnail(file, thumbnailTime)
      setThumbnail(newThumbnail)
    } catch (error) {
      logger.error('Error generating thumbnail', error)
      setError('Failed to generate thumbnail')
    }
  }

  // Handle upload
  const handleUpload = async () => {
    if (!file || !title.trim()) {
      setError('Please provide a file and title')
      return
    }

    setUploading(true)
    setError(null)
    
    try {
      const finalFile = compressionResult?.file || file
      const finalMetadata = compressionResult || videoMetadata
      
      if (!finalMetadata) {
        throw new Error('Video metadata not available')
      }

      await onUpload({
        file: finalFile,
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        tags,
        thumbnail: thumbnail || undefined,
        duration: finalMetadata.duration,
        width: finalMetadata.width,
        height: finalMetadata.height
      })

      // Reset form
      setFile(null)
      setTitle('')
      setDescription('')
      setCategory('hair-styling')
      setTags([])
      setThumbnail('')
      setVideoMetadata(null)
      setCompressionResult(null)
      setProgress(0)
      
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      toast({
        title: 'Upload Successful',
        description: 'Your video has been uploaded successfully!',
      })
    } catch (error) {
      logger.error('Upload error', error)
      setError('Failed to upload video')
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload video. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={cn('space-y-8', className)}>
      {/* File Upload Section */}
      <Card className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Video className="h-5 w-5 text-saffron" />
            Upload Video
          </CardTitle>
          <CardDescription className="text-white/80">
            Select a video file to upload to your portfolio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Input */}
          <div className="space-y-2">
            <Label htmlFor="video-upload" className="text-white font-medium">
              Video File
            </Label>
            <div className="border-2 border-dashed border-white/20 rounded-2xl p-8 text-center hover:border-saffron/50 transition-colors">
              <input
                ref={fileInputRef}
                id="video-upload"
                type="file"
                accept={allowedFormats.join(',')}
                onChange={handleFileInputChange}
                className="hidden"
                disabled={uploading || compressing}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || compressing}
                className="bg-saffron text-primary font-bold rounded-xl px-8 py-3 mb-4"
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose Video
              </Button>
              <p className="text-white/60 text-sm">
                {allowedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')} up to {formatFileSize(maxFileSize)}
              </p>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* File Preview */}
          {file && videoMetadata && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Video Preview */}
                <div className="space-y-2">
                  <Label className="text-white font-medium">Preview</Label>
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black/20">
                    <video
                      ref={videoRef}
                      src={URL.createObjectURL(file)}
                      className="w-full h-full object-cover"
                      controls
                      muted
                    />
                  </div>
                </div>

                {/* Video Info */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white font-medium">Video Information</Label>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-white/60">Duration:</span>
                        <span className="text-white">{formatDuration(videoMetadata.duration)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Resolution:</span>
                        <span className="text-white">{videoMetadata.width} × {videoMetadata.height}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">File Size:</span>
                        <span className="text-white">{formatFileSize(videoMetadata.size)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Compression Options */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-white font-medium">Compression</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCompressionSettings(!showCompressionSettings)}
                        className="text-saffron hover:text-saffron/80"
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Settings
                      </Button>
                    </div>
                    
                    {isVideoCompressionSupported() ? (
                      <Button
                        onClick={handleCompress}
                        disabled={compressing}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {compressing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Compressing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Compress Video
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="text-yellow-400 text-sm">
                        Video compression not supported in this browser
                      </div>
                    )}
                  </div>

                  {/* Compression Progress */}
                  {compressing && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">Compressing...</span>
                        <span className="text-white">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}

                  {/* Compression Result */}
                  {compressionResult && (
                    <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <span className="text-green-400 font-medium">Compressed</span>
                      </div>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-white/60">Original:</span>
                          <span className="text-white">{formatFileSize(compressionResult.originalSize)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Compressed:</span>
                          <span className="text-white">{formatFileSize(compressionResult.compressedSize)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Reduction:</span>
                          <span className="text-green-400">{compressionResult.compressionRatio.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Indeterminate Progress Bar for Upload */}
      {uploading && (
        <div className="w-full mb-4">
          <Progress value={100} className="h-2 animate-pulse bg-white/10" />
          <div className="text-xs text-white/60 text-center mt-1">Uploading...</div>
        </div>
      )}

      {/* Video Details Section */}
      {file && (
        <Card className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl">
          <CardHeader>
            <CardTitle className="text-white">Video Details</CardTitle>
            <CardDescription className="text-white/80">
              Add information about your video
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-white font-medium">
                Title *
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-white font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your video content..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-[100px]"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category" className="text-white font-medium">
                Category
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-darkpurple border-white/20">
                  {categories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value} className="text-white">
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-white font-medium">Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="Add tags..."
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
                <Button
                  onClick={handleAddTag}
                  disabled={!tagInput.trim()}
                  className="bg-saffron text-primary font-bold"
                >
                  Add
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="bg-white/10 text-white border-white/20"
                    >
                      #{tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Thumbnail */}
            <div className="space-y-2">
              <Label className="text-white font-medium">Thumbnail</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max={videoMetadata?.duration || 60}
                      step="0.1"
                      value={thumbnailTime}
                      onChange={(e) => setThumbnailTime(parseFloat(e.target.value))}
                      className="bg-white/10 border-white/20 text-white w-20"
                    />
                    <span className="text-white/60 text-sm">seconds</span>
                    <Button
                      onClick={handleGenerateThumbnail}
                      size="sm"
                      className="bg-saffron text-primary font-bold"
                    >
                      Generate
                    </Button>
                  </div>
                </div>
                {thumbnail && (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black/20">
                    <img
                      src={thumbnail}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compression Settings */}
      {showCompressionSettings && (
        <Card className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl">
          <CardHeader>
            <CardTitle className="text-white">Compression Settings</CardTitle>
            <CardDescription className="text-white/80">
              Configure video compression options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white font-medium">Max Width</Label>
                <Input
                  type="number"
                  value={compressionOptions.maxWidth}
                  onChange={(e) => setCompressionOptions(prev => ({
                    ...prev,
                    maxWidth: parseInt(e.target.value)
                  }))}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white font-medium">Max Height</Label>
                <Input
                  type="number"
                  value={compressionOptions.maxHeight}
                  onChange={(e) => setCompressionOptions(prev => ({
                    ...prev,
                    maxHeight: parseInt(e.target.value)
                  }))}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white font-medium">Max Bitrate (Mbps)</Label>
                <Input
                  type="number"
                  value={compressionOptions.maxBitrate ? compressionOptions.maxBitrate / 1000000 : 2}
                  onChange={(e) => setCompressionOptions(prev => ({
                    ...prev,
                    maxBitrate: parseInt(e.target.value) * 1000000
                  }))}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white font-medium">Max Duration (seconds)</Label>
                <Input
                  type="number"
                  value={compressionOptions.maxDuration}
                  onChange={(e) => setCompressionOptions(prev => ({
                    ...prev,
                    maxDuration: parseInt(e.target.value)
                  }))}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Button */}
      {file && (
        <div className="flex justify-end">
          <Button
            onClick={handleUpload}
            disabled={uploading || !title.trim()}
            className="bg-saffron text-primary font-bold rounded-xl px-8 py-3 hover:bg-saffron/90"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Video
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
} 