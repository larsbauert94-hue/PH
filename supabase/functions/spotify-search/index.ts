// Supabase Edge Function: Songsuche über die Spotify Web API (Client-Credentials-Flow).
// Der Spotify-Schlüssel bleibt auf dem Server und gelangt nie in die App.
//
// Einrichten:
//   npx supabase secrets set SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=...
//   npx supabase functions deploy spotify-search
//
// Aufruf aus der App: supabase.functions.invoke('spotify-search', { body: { q: 'suchbegriff' } })
// Antwort: { tracks: [{ id, title, artist, cover_url, spotify_url, preview_url }] }
//
// Hinweis: Spotify erlaubt nur das Verlinken bzw. Öffnen in Spotify, nicht das Abspielen
// ganzer Songs in fremden Apps oder das Unterlegen eigener Videos.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

let token: { value: string; expires: number } | null = null

async function getToken(): Promise<string> {
  if (token && token.expires > Date.now() + 30_000) return token.value
  const id = Deno.env.get('SPOTIFY_CLIENT_ID')
  const secret = Deno.env.get('SPOTIFY_CLIENT_SECRET')
  if (!id || !secret) throw new Error('SPOTIFY_CLIENT_ID und SPOTIFY_CLIENT_SECRET fehlen')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`Spotify-Token: ${res.status}`)
  const json = await res.json()
  token = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 }
  return token.value
}

interface SpotifyTrack {
  id: string
  name: string
  artists: { name: string }[]
  album: { images: { url: string; width: number }[] }
  external_urls: { spotify: string }
  preview_url: string | null
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { q } = await req.json().catch(() => ({ q: '' }))
    const query = String(q ?? '').trim().slice(0, 100)
    if (!query) return Response.json({ tracks: [] }, { headers: cors })

    const url = new URL('https://api.spotify.com/v1/search')
    url.searchParams.set('q', query)
    url.searchParams.set('type', 'track')
    url.searchParams.set('limit', '20')
    url.searchParams.set('market', 'DE')
    const res = await fetch(url, { headers: { Authorization: `Bearer ${await getToken()}` } })
    if (!res.ok) throw new Error(`Spotify-Suche: ${res.status}`)
    const json = await res.json()
    const tracks = (json.tracks?.items ?? []).map((t: SpotifyTrack) => ({
      id: t.id,
      title: t.name,
      artist: t.artists.map(a => a.name).join(', '),
      // mittelgroßes Cover (ca. 300 px) bevorzugen
      cover_url: [...t.album.images].sort((a, b) => Math.abs(a.width - 300) - Math.abs(b.width - 300))[0]?.url ?? null,
      spotify_url: t.external_urls.spotify,
      preview_url: t.preview_url,
    }))
    return Response.json({ tracks }, { headers: cors })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500, headers: cors })
  }
})
