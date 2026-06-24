'use client';

import { CartProvider } from '@/context/CartContext';
import { Toaster } from 'sonner';
import { ReactNode } from 'react';

import { useEffect } from 'react';

export default function ClientProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('PWA ServiceWorker registered with scope: ', registration.scope);
          },
          (err) => {
            console.error('PWA ServiceWorker registration failed: ', err);
          }
        );
      });
    }
  }, []);

  return (
    <CartProvider>
      {children}
      <Toaster theme="dark" position="bottom-right" />
    </CartProvider>
  );
}
