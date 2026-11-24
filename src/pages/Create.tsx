import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImagePlus, X } from 'lucide-react'
import { useStore } from '../store'
import { CATEGORIES } from '../data/seed'
import type { DrinkCategory } from '../types'
import { CategoryChip, DrinkVisual, Stars } from '../components/ui'
import { TopBar } from '../components/Layout'

/** Bild verkleinern, damit es in den lokalen Speicher passt */
function resizeImage(file: File, max = 1080): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

const field = 'w-full rounded-xl bg-ink-800 px-3 py-2.5 text-sm outline-none placeholder:text-cream/35 focus:ring-2 focus:ring-wine-500'

export default function Create() {
  const { venues, addPost } = useStore()
  const nav = useNavigate()
  const [image, setImage] = useState<string>()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<DrinkCategory>('rotwein')
  const [producer, setProducer] = useState('')
  const [vintage, setVintage] = useState('')
  const [region, setRegion] = useState('')
  const [rating, setRating] = useState(4)
  const [notes, setNotes] = useState('')
  const [venueId, setVenueId] = useState('')

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setImage(await resizeImage(f))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    addPost({
      image,
      rating,
      notes: notes.trim(),
      venueId: venueId || undefined,
      drink: {
        name: name.trim(),
        category,
        producer: producer.trim() || undefined,
        vintage: vintage ? Number(vintage) : undefined,
        region: region.trim() || undefined,
      },
    })
    nav('/')
  }

  return (
    <form onSubmit={submit}>
      <TopBar
        title="Neuer Beitrag"
        right={<button disabled={!name.trim()} className="text-amber-400 font-semibold disabled:text-cream/30">Teilen</button>}
      />
      <div className="p-4 space-y-4">
        <div className="relative rounded-2xl overflow-hidden">
          {image ? (
            <>
              <img src={image} alt="" className="w-full aspect-square object-cover" />
              <button type="button" onClick={() => setImage(undefined)} aria-label="Foto entfernen" className="absolute top-2 right-2 rounded-full bg-ink-950/70 p-1.5"><X size={18} /></button>
            </>
          ) : (
            <label className="block cursor-pointer">
              <DrinkVisual drink={{ name: name || 'Dein Glas', category }} className="w-full aspect-square opacity-70" />
              <span className="absolute inset-0 grid place-items-center">
                <span className="flex items-center gap-2 rounded-full bg-ink-950/80 px-4 py-2 text-sm"><ImagePlus size={18} /> Foto hinzufügen</span>
              </span>
              <input type="file" accept="image/*" capture="environment" onChange={onFile} className="sr-only" />
            </label>
          )}
        </div>

        <input value={name} onChange={e => setName(e.target.value)} placeholder="Was trinkst du? *" className={field} required />

        <div className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORIES) as DrinkCategory[]).map(c => (
            <CategoryChip key={c} category={c} active={category === c} onClick={() => setCategory(c)} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input value={producer} onChange={e => setProducer(e.target.value)} placeholder="Produzent / Brennerei" className={`${field} col-span-2`} />
          <input value={vintage} onChange={e => setVintage(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="Jahrgang / Alter" className={field} />
          <input value={region} onChange={e => setRegion(e.target.value)} placeholder="Region" className={field} />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-ink-800 px-3 py-1.5">
          <span className="text-sm text-cream/70">Bewertung</span>
          <Stars value={rating} onChange={setRating} size={22} />
        </div>

        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Tasting Notes: Nase, Gaumen, Abgang …" className={field} />

        <select value={venueId} onChange={e => setVenueId(e.target.value)} className={field}>
          <option value="">Ort markieren (optional)</option>
          {venues.map(v => <option key={v.id} value={v.id}>{v.name} – {v.city}</option>)}
        </select>
      </div>
    </form>
  )
}
