import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Trader Daily Snapshot',
  description: 'Open positions, day P&L and risk, updating in real time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Dark is the default (trading desks live in it). ThemeToggle can switch it.
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">{children}</body>
    </html>
  );
}
