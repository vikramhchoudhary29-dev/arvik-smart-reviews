import './globals.css';
export const metadata = {
  title: 'Arvik Smart Reviews',
  description: 'Genuine feedback with NFC and QR review assistance',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
