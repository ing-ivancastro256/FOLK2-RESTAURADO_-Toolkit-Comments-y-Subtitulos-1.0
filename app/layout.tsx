import type {Metadata} from 'next';
import { Poppins, Inter } from 'next/font/google';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'YouTube Content Toolkit — Inspector, Miniaturas, Transcripción e IA',
  description: 'Herramienta profesional para creadores de YouTube: extracción de metadatos reales, miniaturas en máxima resolución, transcripciones sincronizadas y repurposing con IA.',
  openGraph: {
    title: 'YouTube Content Toolkit',
    description: 'Herramienta profesional para creadores de YouTube: extracción de metadatos reales, miniaturas en máxima resolución, transcripciones sincronizadas y repurposing con IA.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YouTube Content Toolkit',
    description: 'Herramienta profesional para creadores de YouTube: extracción de metadatos reales, miniaturas en máxima resolución, transcripciones sincronizadas y repurposing con IA.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="es" className={`${poppins.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-white text-[#121111] dark:bg-slate-950 dark:text-slate-100 antialiased selection:bg-[#2848F0] selection:text-white dark:selection:bg-rose-500 font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
