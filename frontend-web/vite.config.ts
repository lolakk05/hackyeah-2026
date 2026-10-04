import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_URL || 'https://easeful-sulphate-lethargic.ngrok-free.dev'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/places': {
          target: apiTarget,
          changeOrigin: true,
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        },
        '/api/auth': {
          target: apiTarget,
          changeOrigin: true,
          cookieDomainRewrite: '',
          cookiePathRewrite: '/',
          headers: {
            'ngrok-skip-browser-warning': 'true',
            origin: apiTarget,
          },
          configure(proxy) {
            proxy.on('proxyRes', (proxyResponse) => {
              const cookies = proxyResponse.headers['set-cookie']
              if (!cookies) return
              proxyResponse.headers['set-cookie'] = cookies.map((cookie) =>
                cookie
                  .replace(/;\s*Secure(?=;|$)/gi, '')
                  .replace(/;\s*SameSite=None(?=;|$)/gi, '; SameSite=Lax'),
              )
            })
          },
        },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
