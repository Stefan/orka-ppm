'use client'

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react'

const STORAGE_KEY = 'orka-ppm-current-portfolio-id'

export interface Portfolio {
  id: string
  name: string
  description?: string | null
  owner_id: string
}

export interface PortfolioContextType {
  currentPortfolioId: string | null
  currentPortfolio: Portfolio | null
  setCurrentPortfolioId: (id: string | null) => void
  portfolios: Portfolio[]
  setPortfolios: (list: Portfolio[]) => void
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined)

export function usePortfolio(): PortfolioContextType {
  const ctx = useContext(PortfolioContext)
  // #region agent log
  if (ctx === undefined) {
    fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PortfolioContext.tsx:usePortfolio','message':'usePortfolio called but context undefined',data:{hasContext:false},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    throw new Error('usePortfolio must be used within a PortfolioProvider')
  }
  // #endregion
  return ctx
}

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [currentPortfolioId, setCurrentPortfolioIdState] = useState<string | null>(null)
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])

  const currentPortfolio = currentPortfolioId
    ? portfolios.find((p) => p.id === currentPortfolioId) ?? null
    : null

  const setCurrentPortfolioId = useCallback((id: string | null) => {
    setCurrentPortfolioIdState(id)
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setCurrentPortfolioIdState(stored)
  }, [])

  useEffect(() => {
    if (portfolios.length === 1 && !currentPortfolioId) {
      setCurrentPortfolioId(portfolios[0].id)
    }
  }, [portfolios, currentPortfolioId, setCurrentPortfolioId])

  const value: PortfolioContextType = {
    currentPortfolioId,
    currentPortfolio,
    setCurrentPortfolioId,
    portfolios,
    setPortfolios,
  }

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  )
}
