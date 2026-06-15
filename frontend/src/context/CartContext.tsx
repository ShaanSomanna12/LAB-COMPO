'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface ComponentItem {
  component_id: string;
  name: string;
  department: string;
  lab_location: string;
  value_tier?: string;
}

interface CartContextType {
  cart: ComponentItem[];
  addToCart: (item: ComponentItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<ComponentItem[]>([]);

  const addToCart = (item: ComponentItem) => {
    setCart((prev) => {
      if (prev.find((c) => c.component_id === item.component_id)) return prev;
      return [...prev, item];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((c) => c.component_id !== id));
  };

  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
