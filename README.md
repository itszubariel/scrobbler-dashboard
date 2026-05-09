# Last.fm Scrobbler Dashboard

A beautiful, feature-rich Last.fm scrobbler dashboard with Discord OAuth authentication. View your music stats, discover new artists, get AI-generated personality insights, and check compatibility with friends.

## Features

### 📊 Statistics & Analytics
- **Overview**: Total scrobbles, top artists, albums, and tracks with AI-generated bio
- **Charts**: Interactive visualizations of your listening history
- **Recent Tracks**: Real-time display of your current and recent plays
- **Wrapped**: Spotify Wrapped-style summaries of your music year

### 🎵 Discovery & Insights
- **Discover**: Find new music based on your taste with Last.fm recommendations
- **Insights**: AI-powered personality analysis based on your music taste
- **Compatibility**: Compare your music taste with other Last.fm users

### 🎨 Design
- Warm paper aesthetic with purple gradient accents
- Responsive design that works on all devices
- Smooth animations and skeleton loading states
- Dark theme optimized for readability

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Routing**: React Router v7
- **Styling**: Tailwind CSS with custom design tokens
- **Charts**: Recharts
- **Backend**: Netlify Functions (serverless)
- **Database**: PostgreSQL (Supabase) with Prisma ORM
- **Authentication**: Discord OAuth 2.0
- **AI**: Groq API for bio and personality generation
- **APIs**: Last.fm API for music data

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Discord application with OAuth2 configured
- Last.fm API key
- Groq API key
- PostgreSQL database (Supabase recommended)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd scrobbler-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (see [Environment Variables](#environment-variables))

4. Generate Prisma client:
```bash
npx prisma generate
```

5. Run development server:
```bash
npm run dev
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Client-side variables (embedded in bundle)
VITE_DISCORD_CLIENT_ID=your_discord_client_id
VITE_LASTFM_API_KEY=your_lastfm_api_key
VITE_DEV_BYPASS_USER=your_lastfm_username  # Optional: bypass auth in dev

# Server-side variables (Netlify Functions only)
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your_random_jwt_secret
GROQ_API_KEY=your_groq_api_key
```

See [NETLIFY_ENV_SETUP.md](./NETLIFY_ENV_SETUP.md) for detailed Netlify configuration.

## Authentication Flow

1. User clicks "Login with Discord"
2. Discord OAuth redirects to `/callback` with authorization code
3. Netlify function exchanges code for Discord user info
4. Database check: Does this Discord ID have a linked Last.fm account?
5. If **YES**: Redirect to `/user/{lastfm_username}` with session cookie
6. If **NO**: Show `/link-required` page with instructions

### Linking Last.fm Account

Users must link their Last.fm account via the Discord bot:
- Bot website: [scrobbler.netlify.app](https://scrobbler.netlify.app)
- Use `/link` command in Discord to connect Last.fm account

## Project Structure

```
scrobbler-dashboard/
├── src/
│   ├── components/          # React components
│   │   ├── Overview.tsx     # User stats with AI bio
│   │   ├── Charts.tsx       # Listening history charts
│   │   ├── RecentTracks.tsx # Now playing & recent
│   │   ├── Discover.tsx     # Music recommendations
│   │   ├── Insights.tsx     # AI personality analysis
│   │   ├── Taste.tsx        # Top artists/albums/tracks
│   │   ├── Wrapped.tsx      # Year in review
│   │   └── Compatibility.tsx # User comparison
│   ├── pages/               # Route pages
│   │   ├── Home.tsx         # Landing page
│   │   ├── Dashboard.tsx    # Main dashboard
│   │   ├── Callback.tsx     # OAuth callback handler
│   │   └── LinkRequired.tsx # Link account prompt
│   ├── lib/                 # Utilities
│   │   ├── lastfm.ts        # Last.fm API client
│   │   └── cache.ts         # Two-tier caching system
│   ├── types/               # TypeScript types
│   └── App.tsx              # Root component with routing
├── netlify/functions/       # Serverless functions
│   ├── auth-discord.ts      # Discord OAuth handler
│   ├── auth-check.ts        # Session validation
│   ├── auth-logout.ts       # Logout handler
│   └── generate-bio.js      # AI bio generation
├── prisma/
│   └── schema.prisma        # Database schema
└── public/
    └── _redirects           # Netlify routing config
```

## Caching Strategy

### Tier 1: Memory-Only Cache
Resets on page refresh. Used for frequently changing data:
- Recent tracks
- Now playing status
- Scrobble count

### Tier 2: localStorage with TTL
Persists across sessions. Used for stable data:
- Overview stats (6 hours)
- Charts (6 hours)
- Taste data (6 hours)
- Wrapped summaries (24 hours)
- Discover recommendations (12 hours)
- AI insights (24 hours)
- AI bio (6 hours)

## API Endpoints

### Netlify Functions

- `GET /api/auth-discord?code={code}` - Discord OAuth callback
- `GET /api/auth-check` - Validate session cookie
- `POST /api/auth-logout` - Clear session
- `POST /api/generate-bio` - Generate AI bio (body: `{username, topArtists, topTracks}`)

### Last.fm API

All Last.fm API calls are made client-side using the public API key.

## Deployment

### Netlify

1. Connect your repository to Netlify
2. Configure environment variables (see [NETLIFY_ENV_SETUP.md](./NETLIFY_ENV_SETUP.md))
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. Deploy!

The `public/_redirects` file handles routing:
- `/api/*` → Netlify Functions
- `/*` → `index.html` (SPA routing)

## Security

- JWT session tokens with 30-day expiration
- HttpOnly, Secure, SameSite cookies
- Server-side secrets never exposed to client
- Last.fm API key is intentionally public (read-only, rate-limited)
- See [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) for full security analysis

## Development

### Build
```bash
npm run build
```

### Lint
```bash
npm run lint
```

### Preview Production Build
```bash
npm run preview
```

## Related Projects

- **Discord Bot**: [scrobbler.netlify.app](https://scrobbler.netlify.app)
- **Invite Bot**: [scrobbler.netlify.app/invite](https://scrobbler.netlify.app/invite)

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
