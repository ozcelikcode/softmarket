'use client'

import { createContext, createElement, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'

type Alternates = { pathname: string; hrefs: Record<string, string> } | null
const AlternatesContext = createContext<{
  current: Alternates
  setCurrent: Dispatch<SetStateAction<Alternates>>
} | null>(null)

/** Each rendered app tree owns its state; neither SSR requests nor app roots share a registry. */
export function AlternatesProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Alternates>(null)
  return createElement(AlternatesContext.Provider, { value: { current, setCurrent } }, children)
}

export function useAlternates() {
  const store = useContext(AlternatesContext)
  if (!store) throw new Error('AlternatesProvider is required')
  return store
}
