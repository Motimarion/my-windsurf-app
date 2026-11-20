import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base יחסי: הבנייה עובדת מכל תיקייה (למשל GitHub Pages תחת /my-windsurf-app/insights/), בלי שינוי בקוד.
export default defineConfig({
  base: './',
  plugins: [react()],
})
