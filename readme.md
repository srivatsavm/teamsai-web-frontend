
# TeamsAI Web Frontend

A React-based web frontend for the TeamsAI Document Assistant.

## Quick Start

1. **Update API URL**: Edit `.env.local` with your backend API URL
2. **Complete Setup**: Replace `src/App.jsx` with the full component code from the deployment guide
3. **Start Development**: Run `npm run dev`
4. **Build for Production**: Run `npm run build`

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

This project is configured for Azure Static Web Apps. See the deployment guide for detailed instructions.

## Environment Variables

- `VITE_API_BASE_URL`: Backend API base URL
- `VITE_APP_TITLE`: Application title
- `VITE_MAX_FILE_SIZE`: Maximum file upload size in bytes