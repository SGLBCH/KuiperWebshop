import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  seedBaseplaten,
  seedFineers,
  seedHPL,
  seedBewerkingen,
} from '@/lib/seed-data'
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/supabase/config'

type SyncResult = {
  inserted: number
  existing: number
}

function hasMissingColumnError(error: { message?: string; code?: string } | null) {
  return error?.code === 'PGRST204' || error?.message?.includes('Could not find')
}

export async function POST() {
  const supabaseUrl = getSupabaseUrl()
  const serviceRoleKey = getSupabaseServiceRoleKey()

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Supabase service role key is not configured.' },
      { status: 503 }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  try {
    const baseplaten = await syncBaseplaten(supabase)
    const fineers = await syncFineers(supabase)
    const hpl = await syncHpl(supabase)
    const bewerkingen = await syncBewerkingen(supabase)

    return NextResponse.json({ baseplaten, fineers, hpl, bewerkingen })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Catalogus synchroniseren mislukt.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncBaseplaten(supabase: any): Promise<SyncResult> {
  const { data, error } = await supabase
    .from('baseplaten')
    .select('naam, dikte_mm, breedte_mm, lengte_mm')

  if (error) throw new Error(error.message)

  const existing = new Set((data ?? []).map((row: {
    naam: string
    dikte_mm: number
    breedte_mm: number
    lengte_mm: number
  }) => `${row.naam}|${row.dikte_mm}|${row.breedte_mm}|${row.lengte_mm}`))

  const missing = seedBaseplaten
    .filter(row => !existing.has(`${row.naam}|${row.dikte_mm}|${row.breedte_mm}|${row.lengte_mm}`))
    .map(({ id: _id, ...row }) => row)

  if (missing.length === 0) return { inserted: 0, existing: existing.size }

  const { error: insertError } = await supabase.from('baseplaten').insert(missing)
  if (insertError) throw new Error(insertError.message)

  return { inserted: missing.length, existing: existing.size }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncFineers(supabase: any): Promise<SyncResult> {
  const { data, error } = await supabase.from('fineers').select('naam')
  if (error) throw new Error(error.message)

  const existing = new Set((data ?? []).map((row: { naam: string }) => row.naam))
  const missing = seedFineers
    .filter(row => !existing.has(row.naam))
    .map(({ id: _id, ...row }) => row)

  if (missing.length === 0) return { inserted: 0, existing: existing.size }

  const { error: insertError } = await supabase.from('fineers').insert(missing)
  if (insertError) {
    if (hasMissingColumnError(insertError)) {
      const legacyRows = missing.map(({ calculatie_factor: _factor, plak_overhead_per_m2: _overhead, ...row }) => row)
      const { error: legacyError } = await supabase.from('fineers').insert(legacyRows)
      if (legacyError) throw new Error(legacyError.message)
    } else {
      throw new Error(insertError.message)
    }
  }

  return { inserted: missing.length, existing: existing.size }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncHpl(supabase: any): Promise<SyncResult> {
  const { data, error } = await supabase.from('hpl').select('kleur')
  if (error) throw new Error(error.message)

  const existing = new Set((data ?? []).map((row: { kleur: string }) => row.kleur))
  const missing = seedHPL
    .filter(row => !existing.has(row.kleur))
    .map(({ id: _id, ...row }) => row)

  if (missing.length === 0) return { inserted: 0, existing: existing.size }

  const { error: insertError } = await supabase.from('hpl').insert(missing)
  if (insertError) throw new Error(insertError.message)

  return { inserted: missing.length, existing: existing.size }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncBewerkingen(supabase: any): Promise<SyncResult> {
  const { data, error } = await supabase.from('bewerkingen').select('naam')
  if (error) throw new Error(error.message)

  const existing = new Set((data ?? []).map((row: { naam: string }) => row.naam))
  const missing = seedBewerkingen
    .filter(row => !existing.has(row.naam))
    .map(({ id: _id, ...row }) => row)

  if (missing.length === 0) return { inserted: 0, existing: existing.size }

  const { error: insertError } = await supabase.from('bewerkingen').insert(missing)
  if (insertError) {
    if (hasMissingColumnError(insertError)) {
      const legacyRows = missing.map(({ standaard_geselecteerd: _standaard, ...row }) => row)
      const { error: legacyError } = await supabase.from('bewerkingen').insert(legacyRows)
      if (legacyError) throw new Error(legacyError.message)
    } else {
      throw new Error(insertError.message)
    }
  }

  return { inserted: missing.length, existing: existing.size }
}
