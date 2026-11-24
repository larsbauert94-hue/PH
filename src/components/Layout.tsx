import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ChevronLeft, Compass, Home, MapPin, PlusSquare, User } from 'lucide-react'
import type { ReactNode } from 'react'

const tabs = [
  { to: '/', icon: Home, label: 'Feed' },
  { to: '/entdecken', icon: Compass, label: 'Entdecken' },
  { to: '/neu', icon: PlusSquare, label: 'Posten' },
  { to: '/orte', icon: MapPin, label: 'Orte' },
  { to: '/profil', icon: User, label: 'Profil' },
]

export default function Layout() {
  return (
    <div className="mx-auto max-w-md min-h-full bg-ink-950 border-x border-ink-800 pb-20">
      <Outlet />
      <nav className="fixed bottom-0 inset-x-0 mx-auto max-w-md bg-ink-950/95 backdrop-blur border-t border-ink-800 pb-[env(safe-area-inset-bottom)]">
        <ul className="flex justify-around">
          {tabs.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] ${isActive ? 'text-amber-400' : 'text-cream/60'}`}
              >
                <Icon size={24} /> {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export function TopBar({ title, back, right }: { title: ReactNode; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 h-14 px-4 bg-ink-950/95 backdrop-blur border-b border-ink-800">
      {back && <button onClick={() => nav(-1)} aria-label="Zurück" className="-ml-2 p-1"><ChevronLeft size={26} /></button>}
      <h1 className="flex-1 truncate font-serif text-xl">{title}</h1>
      {right}
    </header>
  )
}
