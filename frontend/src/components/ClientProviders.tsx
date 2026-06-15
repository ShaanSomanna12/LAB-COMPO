'use client';

import { CartProvider } from '@/context/CartContext';
import { Toaster } from 'sonner';
import { ReactNode } from 'react';

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      {children}
      <Toaster theme="dark" position="bottom-right" />
    </CartProvider>
  );
}
