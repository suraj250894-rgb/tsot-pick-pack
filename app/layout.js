import './globals.css'

export const metadata = {
  title: 'TSOT Pick & Pack Dashboard',
  description: 'The Secret of Tea — Fulfillment Dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
