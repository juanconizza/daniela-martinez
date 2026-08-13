export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Nombres numéricos (backward compat con componentes existentes)
        'color-1': 'var(--color-1)',
        'color-2': 'var(--color-2)',
        'color-3': 'var(--color-3)',
        'color-4': 'var(--color-4)',
        'color-5': 'var(--color-5)',
        // Nombres semánticos (preferir en componentes nuevos)
        'color-primary':   'var(--color-primary)',
        'color-secondary': 'var(--color-secondary)',
        'color-cta':       'var(--color-cta)',
        'color-text':      'var(--color-text)',
        'color-accent':    'var(--color-accent)',
      },
      fontFamily: {
        text: ['Outfit', 'sans-serif'],
      },
    },
  },
}