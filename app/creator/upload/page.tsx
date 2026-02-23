"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { authService, type User } from "@/lib/auth"
import { Upload, Mic, MicOff, Play, Pause, Trash2, ArrowLeft, Loader2 } from "lucide-react"

export default function RitualUpload() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    care_level: "level1" as "level1" | "level2" | "level3",
    cultural_declaration: "",
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const router = useRouter()

  useEffect(() => {
    const loadUser = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }

        const userData = await authService.getProfile()
        if (userData.role !== "creator") {
          router.push("/dashboard")
          return
        }

        setUser(userData)
      } catch (err) {
        console.error("Failed to load user:", err)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [router])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      const chunks: BlobPart[] = []
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/mp3" })
        setRecordedBlob(blob)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 300) {
            // 5 minutes limit
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    } catch (err) {
      console.error("Failed to start recording:", err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }

  const playRecording = () => {
    if (recordedBlob && !isPlaying) {
      const url = URL.createObjectURL(recordedBlob)
      audioRef.current = new Audio(url)
      audioRef.current.play()
      audioRef.current.onended = () => setIsPlaying(false)
      setIsPlaying(true)
    } else if (audioRef.current && isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  const deleteRecording = () => {
    setRecordedBlob(null)
    setRecordingTime(0)
    setIsPlaying(false)
    if (audioRef.current) {
      audioRef.current.pause()
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith("audio/")) {
      setUploadedFile(file)
      setRecordedBlob(null) // Clear recording if file is uploaded
    }
  }

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.description || (!recordedBlob && !uploadedFile)) {
      return
    }

    setUploading(true)
    try {
      const submitData = new FormData()
      submitData.append("title", formData.title)
      submitData.append("description", formData.description)
      submitData.append("care_level", formData.care_level)
      submitData.append("cultural_declaration", formData.cultural_declaration)

      tags.forEach((tag) => {
        submitData.append("tags", tag)
      })

      if (recordedBlob) {
        submitData.append("audio_file", recordedBlob, "recording.mp3")
      } else if (uploadedFile) {
        submitData.append("audio_file", uploadedFile)
      }

      await authService.uploadRitual(submitData)
      router.push("/creator")
    } catch (err) {
      console.error("Failed to upload ritual:", err)
    } finally {
      setUploading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 lg:py-12 max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => router.back()} className="bg-transparent border-border text-foreground hover:bg-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Upload Sacred Ritual</h1>
            <p className="text-muted-foreground">Share your practice with the community</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Audio Source</CardTitle>
              <CardDescription>Record directly or upload an existing audio file</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Recording Section */}
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Mic className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Record New Ritual</h3>
                <p className="text-muted-foreground mb-4">Maximum 5 minutes</p>

                {!recordedBlob ? (
                  <Button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    variant={isRecording ? "destructive" : "default"}
                    size="lg"
                  >
                    {isRecording ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                    {isRecording ? `Recording... ${formatTime(recordingTime)}` : "Start Recording"}
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Recording complete: {formatTime(recordingTime)}</p>
                    <div className="flex gap-2 justify-center">
                      <Button type="button" onClick={playRecording} variant="outline">
                        {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        {isPlaying ? "Pause" : "Play"}
                      </Button>
                      <Button type="button" onClick={deleteRecording} variant="outline">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* File Upload Section */}
              <div className="text-center">
                <p className="text-muted-foreground mb-4">Or</p>
                <div className="border-2 border-dashed border-border rounded-lg p-6">
                  <Upload className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Upload Audio File</h3>
                  <p className="text-muted-foreground mb-4">MP3, WAV, or other audio formats</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button type="button" onClick={() => fileInputRef.current?.click()} variant="outline">
                    Choose File
                  </Button>
                  {uploadedFile && <p className="text-sm text-muted-foreground mt-2">Selected: {uploadedFile.name}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Ritual Details</CardTitle>
              <CardDescription>Provide information about your sacred practice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Name your ritual..."
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the purpose and practice of this ritual..."
                  rows={4}
                  required
                />
              </div>

              <div>
                <Label htmlFor="care_level">Care Level</Label>
                <Select
                  value={formData.care_level}
                  onValueChange={(value: "level1" | "level2" | "level3") =>
                    setFormData({ ...formData, care_level: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="level1">Level 1 - Gentle</SelectItem>
                    <SelectItem value="level2">Level 2 - Moderate</SelectItem>
                    <SelectItem value="level3">Level 3 - Intensive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="tags">Tags</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    id="tags"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag..."
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" onClick={addTag} variant="outline">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="cultural_declaration">Cultural Declaration</Label>
                <Textarea
                  id="cultural_declaration"
                  value={formData.cultural_declaration}
                  onChange={(e) => setFormData({ ...formData, cultural_declaration: e.target.value })}
                  placeholder="Acknowledge any cultural traditions or practices this ritual draws from..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1 bg-transparent border-border text-foreground hover:bg-secondary">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={uploading || !formData.title || !formData.description || (!recordedBlob && !uploadedFile)}
              className="flex-1 bg-primary text-primary-foreground hover:bg-gold-muted"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload Ritual"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
