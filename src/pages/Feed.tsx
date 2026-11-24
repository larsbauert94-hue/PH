import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import PostCard from '../components/PostCard'
import { TopBar } from '../components/Layout'

export default function Feed() {
  const { posts, me, venues } = useStore()
  const [mode, setMode] = useState<'folge' | 'alle'>('folge')
  const shown = [...posts]
    .filter(p => mode === 'alle' || p.userId === me.id || me.following.includes(p.userId))
    .sort((a, b) => b.createdAt - a.createdAt)

  return (
    <>
      <TopBar title={<span className="tracking-wide">Pour<span className="text-wine-400">.</span></span>} />

      <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 py-3 border-b border-ink-800">
        {venues.map(v => (
          <Link key={v.id} to={`/v/${v.id}`} className="flex flex-col items-center gap-1 w-16 shrink-0">
            <span className="p-0.5 rounded-full bg-gradient-to-tr from-amber-400 to-wine-500">
              <span
                className="block w-14 h-14 rounded-full border-2 border-ink-950 grid place-items-center font-serif text-lg"
                style={{ background: `hsl(${v.hue} 40% 25%)` }}
              >
                {v.name[0]}
              </span>
            </span>
            <span className="text-[10px] text-cream/70 truncate w-full text-center">{v.name}</span>
          </Link>
        ))}
      </div>

      <div className="flex gap-2 px-4 py-3">
        {(['folge', 'alle'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 text-sm ${mode === m ? 'bg-cream text-ink-950' : 'bg-ink-800 text-cream/70'}`}
          >
            {m === 'folge' ? 'Folge ich' : 'Alle'}
          </button>
        ))}
      </div>

      {shown.length
        ? shown.map(p => <PostCard key={p.id} post={p} />)
        : <p className="p-8 text-center text-sm text-cream/50">Noch nichts hier. Folge Leuten unter „Entdecken“.</p>}
    </>
  )
}
