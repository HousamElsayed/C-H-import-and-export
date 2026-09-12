'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Search } from 'lucide-react'

export function SearchInput({
  placeholder = 'Search…',
  paramName = 'q',
}: {
  placeholder?: string
  paramName?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get(paramName) ?? '')
  const [, startTransition] = useTransition()

  useEffect(() => {
    const current = searchParams.get(paramName) ?? ''
    if (current === value) return

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(paramName, value)
      else params.delete(paramName)
      params.delete('page')
      startTransition(() => router.replace(`${pathname}?${params.toString()}`))
    }, 300)

    return () => clearTimeout(timer)
  }, [value, searchParams, paramName, pathname, router])

  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
      <input
        className="field pl-9"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        type="search"
      />
    </div>
  )
}
