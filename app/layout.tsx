import type { Metadata } from 'next';
import './globals.css';

const SVG_FAVICON_DATA_URI =
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20100%20100%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M%2082%2092%20C%2082%2082%2081%2072%2085%2062%20C%2089%2052%2088%2040%2082%2030%20C%2076%2020%2065%2014%2052%2014%20C%2038%2014%2027%2022%2022%2035%20C%2020%2040%2021%2044%2019%2048%20C%2017%2052%2012%2055%2012%2057%20C%2014%2059%2018%2060%2019%2062%20C%2017%2064%2016%2066%2018%2068%20C%2020%2070%2024%2072%2023%2075%20C%2022%2079%2024%2083%2028%2086%20C%2034%2091%2042%2092%2045%2092%22%20stroke%3D%22%2314213D%22%20stroke-width%3D%225%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20fill%3D%22none%22/%3E%3Cpath%20d%3D%22M%2055%2031%20Q%2055%2049%2073%2049%20Q%2055%2049%2055%2067%20Q%2055%2049%2037%2049%20Q%2055%2049%2055%2031%20Z%22%20fill%3D%22%23FF6B5B%22/%3E%3C/svg%3E';

export const metadata: Metadata = {
  title: 'RebuildIQ — AI-Powered Website Analysis & Reconstruction Platform',
  description:
    'Extract visual and structural design evidence using controlled browser automation, and generate production-grade reconstruction blueprints and Antigravity prompts.',
  icons: {
    icon: [
      { url: SVG_FAVICON_DATA_URI, type: 'image/svg+xml' },
      { url: '/icon.png?v=3', type: 'image/png', sizes: '32x32' },
      { url: '/brand/icon-square.png?v=3', type: 'image/png', sizes: '192x192' },
      { url: '/favicon.ico?v=3', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-icon.png?v=3', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: [SVG_FAVICON_DATA_URI],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Inline SVG Data URI overrides all browser-cached localhost favicons */}
        <link rel="icon" type="image/svg+xml" href={SVG_FAVICON_DATA_URI} />
        <link rel="shortcut icon" type="image/svg+xml" href={SVG_FAVICON_DATA_URI} />
        <link rel="icon" href="/icon.png?v=3" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-icon.png?v=3" sizes="180x180" />
      </head>
      <body className="min-h-screen bg-cream-100 text-navy-500 antialiased">
        {children}
      </body>
    </html>
  );
}
