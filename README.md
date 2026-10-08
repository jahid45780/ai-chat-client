# AI Power Chat

A responsive AI workspace with cookie-authenticated accounts, searchable conversation history, Markdown responses, and progressive AI streaming.

## Setup

Use Node.js 20.9 or newer. Start the backend first (see `../backend/README.md`), then:

```sh
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. Set `NEXT_PUBLIC_API_URL` to the backend API base (default `http://localhost:5000/api/v1`). The frontend sends cookies with API calls; configure the backend `FRONTEND_URL` to match this origin.

## Structure

- `app`: App Router pages and global styling
- `components/auth`, `chat`, `sidebar`, `layout`, `ui`: reusable client and presentation components
- `lib/api`: centralized Axios client and typed feature API functions
- `hooks`: auth context; UI theme preference is local to the browser
- `types`: shared response/domain types

## Features

Register and sign in, create/search/rename/delete conversations, browse messages, edit and resend user messages, regenerate the latest response, stop generation, profile/password management, theme selection, Markdown and GFM rendering, code copy controls, mobile navigation, and a public product landing page.

## Commands

```sh
npm run dev
npm run build
npm start
npm run lint
```

The AI provider key is configured on the backend only. Production deployments should use HTTPS, set the matching frontend origin in backend CORS configuration, and set `NEXT_PUBLIC_API_URL` to the deployed API prefix.
