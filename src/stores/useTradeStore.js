import { create } from 'zustand'

export const useTradeStore = create((set) => ({
  tradeGive: [],
  tradeGet: [],
  profileOverride: 'auto', // 'auto' | 'contender' | 'balanced' | 'rebuild'
  managerGive: null,
  managerGet: null,

  addItem: (side, item) =>
    set((s) => ({
      [side]: s[side].some((i) => i.id === item.id)
        ? s[side]
        : [...s[side], item],
    })),

  removeItem: (side, id) =>
    set((s) => ({ [side]: s[side].filter((i) => i.id !== id) })),

  clearTrade: () => set({ tradeGive: [], tradeGet: [] }),

  setProfileOverride: (v) => set({ profileOverride: v }),
  setManagerGive: (v) => set({ managerGive: v }),
  setManagerGet: (v) => set({ managerGet: v }),
}))
