// store/useStore.ts
"use client";

import {create} from 'zustand';

interface SharedState {
  image: string | File | null | Blob;
  setImage: (image: string | File | Blob) => void; 
  isLoggedIn: boolean; 
  setLoggedIn: (isLoggedIn: boolean) => void; 
  reset: () => void; 
}

export const useStore = create<SharedState>((set) => ({
  image: null,
  setImage: (image) => set({ image }), 
  isLoggedIn: false,
  setLoggedIn: (isLoggedIn) => set({ isLoggedIn }), 
  reset: () => set({ image: null, isLoggedIn: false }),
}));

// export const useStoreMember = create<SharedState>((set) => ({
//   image: null,
//   setImage: (image) => set({ image }),
//   isLoggedIn: false,
//   setLoggedIn: (isLoggedIn) => set({ isLoggedIn }), 
//   reset: () => set({ image: null, isLoggedIn: false }),
// }));