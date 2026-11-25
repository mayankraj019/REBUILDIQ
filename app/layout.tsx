import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RebuildIQ — AI-Powered Website Analysis & Reconstruction Platform',
  description:
    'Extract visual and structural design evidence using controlled browser automation, and generate production-grade reconstruction blueprints and Antigravity prompts.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream-100 text-navy-500 antialiased">
        {children}
      </body>
    </html>
  );
}
