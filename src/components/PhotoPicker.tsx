import { useRef, useState } from 'react'
import { Upload, Link2, X } from 'lucide-react'
import { Button, UrlInput, useToast } from './ui'
import { fixUrl } from '../lib/url'
import { supabase } from '../lib/supabase'

/** Shrink to max 600px and save as JPEG. Keeps uploads small and drops photo metadata (like GPS). */
async function toJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 600 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not read that image.'))), 'image/jpeg', 0.85))
}

/** Headshot: upload a photo or paste a link. Blank = we try their LinkedIn photo after signup. */
export function PhotoPicker({ value, onChange, name }: { value: string; onChange: (url: string) => void; name: string }) {
  const { toast } = useToast()
  const [mode, setMode] = useState<'upload' | 'link'>('upload')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast({ title: 'Please choose an image file', description: 'JPG, PNG, or WebP.', variant: 'destructive' })
    if (file.size > 15_000_000) return toast({ title: 'That image is too large', description: 'Please choose one under 15 MB.', variant: 'destructive' })
    setBusy(true)
    try {
      const blob = await toJpeg(file)
      const path = `uploads/${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage.from('headshots').upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      onChange(supabase.storage.from('headshots').getPublicUrl(path).data.publicUrl)
    } catch (err) {
      toast({ title: 'Upload failed', description: (err as Error).message, variant: 'destructive' })
    }
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {value
          ? <img src={value} alt="Your headshot" className="h-16 w-16 rounded-full object-cover border border-border" onError={() => toast({ title: "That photo link didn't load", description: 'Try uploading the photo instead.', variant: 'destructive' })} />
          : <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center font-bold text-xl" aria-hidden>{(name.trim()[0] || '?').toUpperCase()}</div>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={mode === 'upload' ? 'primary' : 'outline'} className="h-9" onClick={() => { setMode('upload'); fileRef.current?.click() }} disabled={busy}>
            <Upload className="h-4 w-4" /> {busy ? 'Uploading…' : value ? 'Upload a different photo' : 'Upload a photo'}
          </Button>
          <Button type="button" variant={mode === 'link' ? 'primary' : 'outline'} className="h-9" onClick={() => setMode('link')}><Link2 className="h-4 w-4" /> Paste a link</Button>
          {value && <Button type="button" variant="ghost" className="h-9" onClick={() => onChange('')}><X className="h-4 w-4" /> Remove</Button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" aria-label="Upload a headshot photo" onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      {mode === 'link' && (
        <div className="flex gap-2">
          <UrlInput placeholder="Link to a photo of you" value={draft} onChange={setDraft} aria-label="Headshot photo link"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (draft.trim()) { onChange(fixUrl(draft)); setDraft('') } } }} />
          <Button type="button" variant="outline" disabled={!draft.trim()} onClick={() => { onChange(fixUrl(draft)); setDraft('') }}>Use this link</Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Optional. If you skip this, we'll try to use your LinkedIn profile photo. Otherwise students see your initial.</p>
    </div>
  )
}
