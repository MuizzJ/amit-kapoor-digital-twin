import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dr. Amit Kapoor — Economist · Strategist · Author',
  description:
    'Thought leadership on competitiveness, Indian economics, and social progress. Harvard faculty, author of The Age of Awakening and Riding the Tiger.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-white text-[#0a0a0a]">{children}</body>
    </html>
  )
}
