import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/supabase/config'
import type { OfferteRegelData } from '@/lib/offerte-pdf'

// Server-side helpers voor de offerte-flow. Token-gebaseerde toegang loopt
// via de service role omdat de klant vanuit de e-mail niet ingelogd hoeft
// te zijn — het token zelf is de sleutel (uniek UUID per offerte).

export type OfferteRecord = {
  id: string
  aanvraag_id: string | null
  user_id: string
  token: string
  offertenummer: string | null
  status: string
  regels: OfferteRegelData[]
  opmerking: string | null
  vervaldatum: string | null
  verstuurd_op: string | null
  reactie_op: string | null
}

export function getServiceClient() {
  const url = getSupabaseUrl()
  const key = getSupabaseServiceRoleKey()
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

export async function getOfferteByToken(token: string): Promise<{
  offerte: OfferteRecord
  profiel: { naam: string | null; bedrijf: string | null; adres: string | null; email: string | null }
} | null> {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return null
  const supabase = getServiceClient()
  if (!supabase) return null

  const { data: offerte } = await supabase
    .from('offertes')
    .select('*')
    .eq('token', token)
    .single()
  if (!offerte) return null

  const { data: profiel } = await supabase
    .from('profiles')
    .select('naam, bedrijf, adres, email')
    .eq('id', offerte.user_id)
    .single()

  return {
    offerte: offerte as OfferteRecord,
    profiel: profiel ?? { naam: null, bedrijf: null, adres: null, email: null },
  }
}

export const datumNL = (d: string | Date) =>
  new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function isVerlopen(offerte: OfferteRecord): boolean {
  if (!offerte.vervaldatum) return false
  const eind = new Date(offerte.vervaldatum)
  eind.setHours(23, 59, 59)
  return eind.getTime() < Date.now()
}
