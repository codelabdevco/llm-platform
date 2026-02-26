// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LLM Platform',
  description: 'Enterprise LLM Chat Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
