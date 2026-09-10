/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },

        /* ---- Grow & Glow brand palette (from the brand book) ---- */
        lavender: {
          50: 'hsl(262 30% 96%)',
          100: 'hsl(262 26% 92%)',
          200: 'hsl(262 20% 85%)',
          300: 'hsl(262 16% 77%)',
          400: 'hsl(262 14% 70%)' /* #b0a8be */,
          500: 'hsl(262 13% 60%)',
          600: 'hsl(262 13% 48%)',
          700: 'hsl(262 14% 36%)',
        },
        blush: {
          50: 'hsl(11 40% 97%)',
          100: 'hsl(11 34% 94%)',
          200: 'hsl(11 30% 89%)',
          300: 'hsl(11 27% 83%)' /* #e0cdc9 */,
          400: 'hsl(11 24% 72%)',
          500: 'hsl(11 22% 60%)',
          600: 'hsl(11 22% 46%)',
        },
        faded: {
          50: 'hsl(224 34% 96%)',
          100: 'hsl(224 30% 93%)',
          200: 'hsl(224 26% 86%)',
          300: 'hsl(224 24% 79%)' /* #bcc3d6 */,
          400: 'hsl(224 22% 68%)',
          500: 'hsl(224 20% 55%)',
          600: 'hsl(224 20% 42%)',
        },
        sand: {
          50: 'hsl(35 45% 97%)',
          100: 'hsl(35 40% 94%)',
          200: 'hsl(35 36% 88%)',
          300: 'hsl(35 34% 80%)' /* #ddcfbb */,
          400: 'hsl(35 30% 70%)',
          500: 'hsl(35 26% 57%)',
          600: 'hsl(35 26% 44%)',
        },
        silver: {
          100: 'hsl(45 6% 94%)',
          200: 'hsl(45 5% 87%)',
          300: 'hsl(45 4% 78%)',
          400: 'hsl(45 3% 69%)' /* #b1b0ad */,
          500: 'hsl(45 3% 56%)',
          600: 'hsl(45 3% 43%)',
        },
        charcoal: {
          DEFAULT: 'hsl(0 0% 10%)' /* #1A1A1A */,
          soft: 'hsl(0 0% 16%)',
          muted: 'hsl(0 0% 28%)',
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xs: 'calc(var(--radius) - 6px)',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(26 26 26 / 0.05)',
        soft: '0 2px 8px -2px rgb(26 26 26 / 0.06), 0 8px 24px -8px rgb(26 26 26 / 0.08)',
        lifted: '0 4px 12px -4px rgb(26 26 26 / 0.08), 0 16px 40px -12px rgb(26 26 26 / 0.12)',
        glow: '0 0 0 1px rgb(176 168 190 / 0.25), 0 8px 32px -8px rgb(176 168 190 / 0.45)',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['Geist', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        arabic: ['Tajawal', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        widest2: '0.24em',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'caret-blink': {
          '0%,70%,100%': { opacity: '1' },
          '20%,50%': { opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        /* Slow pastel gradient drift — the "soft healing glow" backdrop */
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(3%, -4%, 0) scale(1.08)' },
          '66%': { transform: 'translate3d(-3%, 3%, 0) scale(0.96)' },
        },
        /* Light sweeping across a reflective surface — the "mirror reality" half */
        sheen: {
          '0%': { transform: 'translateX(-120%) skewX(-18deg)' },
          '100%': { transform: 'translateX(320%) skewX(-18deg)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'marquee-rtl': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(50%)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.04)' },
        },
        /* Hero garment: a slow hover-bounce, and a ground shadow that
           tightens as it rises — the pair is what sells the weight. */
        'hero-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-22px)' },
        },
        'hero-shadow': {
          '0%, 100%': { transform: 'scaleX(1)', opacity: '0.3' },
          '50%': { transform: 'scaleX(0.84)', opacity: '0.15' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'caret-blink': 'caret-blink 1.25s ease-out infinite',
        float: 'float 7s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.7s cubic-bezier(0.22,1,0.36,1) forwards',
        'fade-in': 'fade-in 0.6s ease-out forwards',
        'scale-in': 'scale-in 0.5s cubic-bezier(0.22,1,0.36,1) forwards',
        drift: 'drift 22s ease-in-out infinite',
        sheen: 'sheen 2.6s ease-in-out infinite',
        marquee: 'marquee 38s linear infinite',
        'marquee-rtl': 'marquee-rtl 38s linear infinite',
        breathe: 'breathe 6s ease-in-out infinite',
        'hero-bounce': 'hero-bounce 4.5s cubic-bezier(0.45,0,0.55,1) infinite',
        'hero-shadow': 'hero-shadow 4.5s cubic-bezier(0.45,0,0.55,1) infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
