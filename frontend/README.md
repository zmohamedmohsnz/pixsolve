# Pixsolve frontend

The guest image-processing interface is a JavaScript React/Vite application.

## Local development

From the repository root, start the API dependencies and processes first:

```powershell
docker compose up -d mongodb redis
npm run dev
npm run worker:dev
```

Then, in a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to the backend at
`http://localhost:3000`, so no local frontend environment variable is needed.

To create a production build:

```powershell
cd frontend
npm run build
```

Set `VITE_API_BASE_URL` only for a deployed API; it must include `/api/v1`.

Guest job IDs and their one-time credentials are stored only in `sessionStorage`.
They are never included in the address bar or logged by the app.
