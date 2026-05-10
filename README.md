# scrobbler dashboard

A web dashboard for the scrobbler Discord bot. View your Last.fm stats, discover new music, get insights into your listening patterns, and explore your music history with beautiful visualizations.

---

## What is scrobbler dashboard?

scrobbler dashboard is the web companion to the [scrobbler Discord bot](https://scrobbler.netlify.app). After linking your Last.fm account through the bot, you can log in with Discord to access your personalized music dashboard with detailed stats, charts, and insights.

- **Dashboard:** [scrobbler-dashboard.netlify.app](https://scrobbler-dashboard.netlify.app)
- **Discord Bot Repository:** [scrobbler](https://github.com/itszubariel/scrobbler)
- **Bot Website:** [scrobbler.netlify.app](https://scrobbler.netlify.app)
- **Invite Bot:** [scrobbler.netlify.app/invite](https://scrobbler.netlify.app/invite)

---

## Features

- **Overview**: Total scrobbles, top artist and track, now playing card, and AI-generated bio
- **Recent**: Paginated listening history (up to 100 tracks) with now playing status
- **Charts**: Grid visualizations of your top artists, tracks, and albums across time periods
- **Taste**: Your top 50 genres weighted by playcount
- **Streaks**: Longest consecutive daily listening streaks for artists, tracks, and albums over the last 90 days
- **Insights**: Music personality analysis and compatibility checker with other Last.fm users
- **Discover**: Personalized recommendations based on your listening history, plus an underground score
- **Wrapped**: Spotify Wrapped-style slideshow summary of your listening across any time period

All names in the dashboard are clickable, tap any artist, track, album, or genre to open a detail card with stats, tags, bio, and a link to Last.fm.

---

## Getting Started

1. **Invite the bot** - [Add scrobbler to your Discord server](https://scrobbler.netlify.app/invite)
2. **Link your account** - Use `/link` command in Discord to connect your Last.fm
3. **Log in** - Visit [scrobbler-dashboard.netlify.app](https://scrobbler-dashboard.netlify.app) and log in with Discord
4. **Explore** - View your stats, charts, and insights!

---

## Source Availability

This repository is public so all users can verify what the dashboard does and confirm it is safe to use. The source code is **not open source** - you may not copy, self-host, or redistribute it. See [LICENSE.md](LICENSE.md) for details.

---

## Tech Stack

- [React](https://react.dev) 19 with TypeScript
- [Vite](https://vite.dev) for build tooling
- [React Router](https://reactrouter.com) v7 for routing
- [Recharts](https://recharts.org) for data visualizations
- [Netlify Functions](https://www.netlify.com/products/functions/) for serverless backend
- [Prisma](https://prisma.io) with PostgreSQL (Supabase) for database
- [Discord OAuth 2.0](https://discord.com/developers/docs/topics/oauth2) for authentication
- [Groq](https://groq.com) (llama-3.3-70b-versatile) for AI-generated user bios
- [Last.fm API](https://www.last.fm/api) for music data
- [Deezer API](https://developers.deezer.com) for artist artwork
- [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI) for album and track artwork

