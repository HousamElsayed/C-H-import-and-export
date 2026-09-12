import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Clinic CRM',
    template: '%s · Clinic CRM',
  },
  description: 'Client, appointment, billing and stock management for a beauty clinic.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
