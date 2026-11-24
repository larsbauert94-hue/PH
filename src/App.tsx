import { HashRouter, Route, Routes } from 'react-router-dom'
import { StoreProvider } from './store'
import Layout from './components/Layout'
import Feed from './pages/Feed'
import Explore from './pages/Explore'
import Create from './pages/Create'
import Venues from './pages/Venues'
import VenueDetail from './pages/VenueDetail'
import Profile from './pages/Profile'
import PostDetail from './pages/PostDetail'

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Feed />} />
            <Route path="entdecken" element={<Explore />} />
            <Route path="neu" element={<Create />} />
            <Route path="orte" element={<Venues />} />
            <Route path="v/:id" element={<VenueDetail />} />
            <Route path="profil" element={<Profile />} />
            <Route path="u/:id" element={<Profile />} />
            <Route path="p/:id" element={<PostDetail />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}
