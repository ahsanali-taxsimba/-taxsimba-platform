import { Outfit } from 'next/font/google';
import './globals.css';
import './main.css';
import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import SessionProvider from '@/components/providers/SessionProvider';
import ToastProvider from '@/components/providers/ToastProvider';
import "ckeditor5/ckeditor5.css";
import "bootstrap/dist/css/bootstrap.min.css";
import BootstrapClient from '@/components/BootstrapClient';
import SessionTimeout from '@/components/SessionTimeout';
const outfit = Outfit({
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <BootstrapClient />
        <SessionProvider>
          <SessionTimeout />
          <ThemeProvider>
            <SidebarProvider>
              {children}
              <ToastProvider />
            </SidebarProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
