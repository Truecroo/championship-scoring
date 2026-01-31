// API Configuration
// Use environment variable for production (GitHub Pages), fallback to local proxy for dev
export const API_URL = import.meta.env.VITE_API_URL || '/api'

// For development without proxy, use:
// export const API_URL = 'http://localhost:5001/api'
