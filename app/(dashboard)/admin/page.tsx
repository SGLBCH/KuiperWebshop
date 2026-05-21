'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Badge } from '@/components/ui/Badge'
import {
  seedBaseplaten,
  seedFineers,
  seedHPL,
  seedBewerkingen,
  seedStaffelFineerHPL,
  seedStaffelKaal,
  seedInstellingen,
  seedVasteKosten,
} from '@/lib/seed-data'
import type { Baseplaat, Fineer, HPL, Bewerking, StaffelRegel, HotmeltCombinatie } from '@/lib/types'

type AdminTab =
  | 'aanmeldingen'
  | 'klanten'
  | 'aanvragen'
  | 'prijzen'
  | 'staffel'
  | 'galerij_basisplaat'
  | 'galerij_fineer'
  | 'galerij_hpl'
  | 'bewerkingen'
  | 'uitsluitingen'
  | 'insluitingen'

type UitsluitingRow = { id: string; subject_type: string; subject_id: string; uitgesloten_type: string; uitgesloten_id: string; reden: string | null }
type InsluitingRow = { id: string; subject_type: string; subject_id: string; ingesloten_type: string; ingesloten_id: string; reden: string | null }

const DEMO_AANMELDINGEN = [
  { id: 'a1', naam: 'Pieter Smit', bedrijf: 'Smit Interieur', email: 'p.smit@smitinterieur.nl', datum: '2026-05-07', rol: 'kijker' as const },
  { id: 'a2', naam: 'Lisa van der Berg', bedrijf: 'VDB Keukens B.V.', email: 'l.vdberg@vdbkeukens.nl', datum: '2026-05-06', rol: 'kijker' as const },
  { id: 'a3', naam: 'Mark Jansen', bedrijf: 'Jansen Meubelmakerij', email: 'm.jansen@jansen.nl', datum: '2026-05-05', rol: 'kijker' as const },
]

const DEMO_KLANTEN = [
  { id: 'k1', naam: 'Jan de Vries', bedrijf: 'De Vries Interieurbouw', rol: 'calculator', status: 'goedgekeurd', last_seen: '2026-05-08', clicks: 142 },
  { id: 'k2', naam: 'Sandra Peters', bedrijf: 'Peters & Zn.', rol: 'inkoper', status: 'goedgekeurd', last_seen: '2026-05-07', clicks: 89 },
  { id: 'k3', naam: 'Tom van Dijk', bedrijf: 'Van Dijk Timmerwerk', rol: 'kijker', status: 'gedeactiveerd', last_seen: '2026-04-20', clicks: 12 },
]

const DEMO_AANVRAGEN = [
  { id: 'av1', project: 'Keuken Renovatie', klant: 'Jan de Vries', waarde: 3480, aangemaakt: '2026-04-28', verstuurd: '2026-04-28', bericht: true, fineerkeuze: 'fabriek' },
  { id: 'av2', project: 'Kastenwand Slaapkamer', klant: 'Sandra Peters', waarde: 1875, aangemaakt: '2026-04-10', verstuurd: '2026-04-10', bericht: false, fineerkeuze: 'persoonlijk' },
  { id: 'av3', project: 'Wandpanelen Woonkamer', klant: 'Jan de Vries', waarde: 920, aangemaakt: '2026-03-22', verstuurd: '2026-03-22', bericht: false, fineerkeuze: 'foto_kuiper' },
]

type AanmeldingRow = { id: string; naam: string; bedrijf: string; email: string; datum: string; rol: 'kijker' | 'calculator' | 'inkoper' }
type KlantRow = { id: string; naam: string; bedrijf: string; rol: string; status: string; last_seen: string; clicks: number }
type AanvraagRow = {
  id: string
  project: string
  klant: string
  bedrijf: string
  waarde: number
  aangemaakt: string
  verstuurd: string
  bericht: string | null
  fineerkeuze: string | null
}
type ConceptRow = { id: string; naam: string; klant: string; status: string; bijgewerkt: string }

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('aanmeldingen')
  const [loadingData, setLoadingData] = useState(true)

  // Aanmeldingen state
  const [aanmeldingen, setAanmeldingen] = useState<AanmeldingRow[]>([])
  const [rolKeuzes, setRolKeuzes] = useState<Record<string, string>>({})

  // Klanten state
  const [klanten, setKlanten] = useState<KlantRow[]>(DEMO_KLANTEN)

  // Aanvragen state
  const [aanvragen, setAanvragen] = useState<AanvraagRow[]>([])
  const [concepten, setConcepten] = useState<ConceptRow[]>([])

  // Load real data from Supabase on mount
  useEffect(() => {
    async function loadData() {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
          // Demo mode fallback
          setAanmeldingen(DEMO_AANMELDINGEN)
          setRolKeuzes(Object.fromEntries(DEMO_AANMELDINGEN.map(a => [a.id, 'kijker'])))
          setKlanten(DEMO_KLANTEN)
          setLoadingData(false)
          return
        }

        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()

        // Fetch pending registrations
        const { data: pendingData } = await supabase
          .from('profiles')
          .select('id, naam, bedrijf, email, aangemaakt_op')
          .eq('status', 'pending')
          .order('aangemaakt_op', { ascending: false })

        if (pendingData) {
          const rows: AanmeldingRow[] = pendingData.map(p => ({
            id: p.id,
            naam: p.naam ?? '—',
            bedrijf: p.bedrijf ?? '—',
            email: p.email,
            datum: p.aangemaakt_op?.split('T')[0] ?? '—',
            rol: 'kijker' as const,
          }))
          setAanmeldingen(rows)
          setRolKeuzes(Object.fromEntries(rows.map(r => [r.id, 'kijker'])))
        }

        // Fetch approved customers (incl. last_seen_at)
        const { data: klantenData } = await supabase
          .from('profiles')
          .select('id, naam, bedrijf, rol, status, aangemaakt_op, last_seen_at')
          .in('status', ['goedgekeurd', 'gedeactiveerd'])
          .order('aangemaakt_op', { ascending: false })

        if (klantenData && klantenData.length > 0) {
          const userIds = klantenData.map(k => k.id)

          // Activiteit: tel orderlijsten en aanvragen per gebruiker
          const [{ data: olData }, { data: aqData }] = await Promise.all([
            supabase.from('orderlijsten').select('user_id').in('user_id', userIds),
            supabase.from('aanvragen').select('user_id').in('user_id', userIds),
          ])

          const olCount: Record<string, number> = {}
          const aqCount: Record<string, number> = {}
          ;(olData ?? []).forEach((r: { user_id: string }) => { olCount[r.user_id] = (olCount[r.user_id] ?? 0) + 1 })
          ;(aqData ?? []).forEach((r: { user_id: string }) => { aqCount[r.user_id] = (aqCount[r.user_id] ?? 0) + 1 })

          setKlanten(klantenData.map(k => {
            const lastSeenRaw = k.last_seen_at as string | null
            const lastSeen = lastSeenRaw
              ? new Date(lastSeenRaw).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })
              : '—'
            return {
              id: k.id,
              naam: k.naam ?? '—',
              bedrijf: k.bedrijf ?? '—',
              rol: k.rol ?? 'kijker',
              status: k.status,
              last_seen: lastSeen,
              clicks: (olCount[k.id] ?? 0) + (aqCount[k.id] ?? 0),
            }
          }))
        }

        // Fetch aanvragen (verstuurd door klanten)
        const { data: aanvraagData } = await supabase
          .from('aanvragen')
          .select(`
            id, bericht, totaal_waarde, verstuurd_op,
            fineerkeuze_tekst, orderlijst_ids,
            profiles ( naam, bedrijf )
          `)
          .eq('status', 'nieuw')
          .order('verstuurd_op', { ascending: false })

        if (aanvraagData) {
          // Haal orderlijstnamen op via aparte query
          const aanvraagRows: AanvraagRow[] = await Promise.all(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            aanvraagData.map(async (a: any) => {
              let projectNaam = '—'
              const ids = (a.orderlijst_ids as string[]) ?? []
              if (ids.length > 0) {
                const { data: ol } = await supabase
                  .from('orderlijsten')
                  .select('naam')
                  .in('id', ids)
                if (ol?.length) projectNaam = ol.map((o: { naam: string }) => o.naam).join(', ')
              }
              const profiel = a.profiles as { naam: string; bedrijf: string } | null
              return {
                id: a.id,
                project: projectNaam,
                klant: profiel?.naam ?? '—',
                bedrijf: profiel?.bedrijf ?? '—',
                waarde: a.totaal_waarde ?? 0,
                aangemaakt: a.verstuurd_op?.split('T')[0] ?? '—',
                verstuurd: a.verstuurd_op?.split('T')[0] ?? '—',
                bericht: a.bericht ?? null,
                fineerkeuze: a.fineerkeuze_tekst ?? null,
              }
            })
          )
          setAanvragen(aanvraagRows)
        }

        // Fetch concepten (actieve orderlijsten van alle klanten)
        const { data: conceptData } = await supabase
          .from('orderlijsten')
          .select('id, naam, status, bijgewerkt_op, profiles ( naam )')
          .in('status', ['actueel', 'concept'])
          .order('bijgewerkt_op', { ascending: false })

        if (conceptData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setConcepten(conceptData.map((c: any) => ({
            id: c.id,
            naam: c.naam,
            klant: (c.profiles as { naam: string } | { naam: string }[] | null) instanceof Array
              ? (c.profiles as { naam: string }[])[0]?.naam ?? '—'
              : (c.profiles as { naam: string } | null)?.naam ?? '—',
            status: c.status,
            bijgewerkt: c.bijgewerkt_op?.split('T')[0] ?? '—',
          })))
        }

        // Fetch catalog data
        const { data: bpData } = await supabase.from('baseplaten').select('*').order('volgorde', { ascending: true })
        if (bpData && bpData.length > 0) setBaseplaten(bpData as Baseplaat[])

        const { data: fnData } = await supabase.from('fineers').select('*').order('volgorde', { ascending: true })
        if (fnData && fnData.length > 0) setFineers(fnData as Fineer[])

        const { data: hplData } = await supabase.from('hpl').select('*').order('volgorde', { ascending: true })
        if (hplData && hplData.length > 0) setHplList(hplData as HPL[])

        const { data: bwData } = await supabase.from('bewerkingen').select('*').order('volgorde', { ascending: true })
        if (bwData && bwData.length > 0) setBewerkingen(bwData as Bewerking[])

        const { data: uitData } = await supabase.from('uitsluitingen').select('*')
        if (uitData) setUitsluitingen(uitData as UitsluitingRow[])

        const { data: inslData } = await supabase.from('insluitingen').select('*')
        if (inslData) setInsluitingen(inslData as InsluitingRow[])

        const { data: insData } = await supabase.from('instellingen').select('*')
        if (insData) {
          const get = (key: string, def: number) => parseFloat(insData.find(i => i.sleutel === key)?.waarde ?? String(def))
          setFineerlijm(get('fineerlijm_per_m2', seedVasteKosten.fineerlijm_per_m2))
          setSchuurbanden(get('schuurbanden_per_m2', seedVasteKosten.schuurbanden_per_m2))
          setHplLijm(get('hpl_lijm_per_m2', seedVasteKosten.hpl_lijm_per_m2))
          setPuHotmelt(get('pu_hotmelt_per_m2', seedVasteKosten.pu_hotmelt_per_m2))
          const fhRaw = insData.find(i => i.sleutel === 'staffel_fineer_hpl')?.waarde
          const kaalRaw = insData.find(i => i.sleutel === 'staffel_kaal')?.waarde
          if (fhRaw) { try { setStaffelFH(JSON.parse(fhRaw)) } catch { /* keep seed */ } }
          if (kaalRaw) { try { setStaffelKaal(JSON.parse(kaalRaw)) } catch { /* keep seed */ } }
        }
        const { data: hmData } = await supabase.from('hotmelt_combinaties').select('*')
        if (hmData) setHotmeltCombs(hmData as HotmeltCombinatie[])

      } catch (err) {
        console.error('Failed to load admin data:', err)
        // Keep demo data on error
        setAanmeldingen(DEMO_AANMELDINGEN)
        setRolKeuzes(Object.fromEntries(DEMO_AANMELDINGEN.map(a => [a.id, 'kijker'])))
      } finally {
        setLoadingData(false)
      }
    }
    loadData()
  }, [])

  async function printAanvraag(aanvraagId: string) {
    const toastId = toast.loading('Aanvraag ophalen…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      // Fetch aanvraag + profile
      const { data: aanvraag } = await supabase
        .from('aanvragen')
        .select('id, bericht, totaal_waarde, verstuurd_op, fineerkeuze_tekst, orderlijst_ids, profiles ( naam, bedrijf, adres, kvk, email )')
        .eq('id', aanvraagId)
        .single()

      if (!aanvraag) { toast.error('Aanvraag niet gevonden', { id: toastId }); return }

      // Fetch all bewerkingen (for name lookups)
      const { data: allBewerkingen } = await supabase.from('bewerkingen').select('id, naam')
      const bewNaam = (id: string) => allBewerkingen?.find(b => b.id === id)?.naam ?? id

      // Fetch orderlijsten + regels for each orderlijst_id
      const ids: string[] = (aanvraag.orderlijst_ids as string[]) ?? []
      type RegelData = {
        id: string; categorie: string; aantal: number; ruimte_indeling: string
        ruimtes: { naam: string; aantal: number }[]
        voegmethode: string | null; bewerkingen: string[]
        prijs_per_stuk: number; totaal_prijs: number
        basisplaat: { naam: string; dikte_mm: number; breedte_mm: number; lengte_mm: number } | null
        fineer_voor: { naam: string; gallery_foto_url: string | null; fk_advies: string } | null
        fineer_tegen: { naam: string; fk_advies: string } | null
        hpl_voor: { kleur: string; gallery_foto_url: string | null } | null
        hpl_tegen: { kleur: string } | null
      }
      type OrderlijstData = { id: string; naam: string; regels: RegelData[] }
      const orderlijsten: OrderlijstData[] = []

      for (const olId of ids) {
        const { data: ol } = await supabase.from('orderlijsten').select('id, naam').eq('id', olId).single()
        const { data: regels } = await supabase
          .from('orderlijst_regels')
          .select(`
            id, categorie, aantal, ruimte_indeling, ruimtes, voegmethode, bewerkingen,
            prijs_per_stuk, totaal_prijs,
            basisplaat:baseplaten ( naam, dikte_mm, breedte_mm, lengte_mm ),
            fineers_voor:fineers!orderlijst_regels_fineer_voor_fkey ( naam, gallery_foto_url, fk_advies ),
            fineers_tegen:fineers!orderlijst_regels_fineer_tegen_fkey ( naam, fk_advies ),
            hpl_voor_data:hpl!orderlijst_regels_hpl_voor_fkey ( kleur, gallery_foto_url ),
            hpl_tegen_data:hpl!orderlijst_regels_hpl_tegen_fkey ( kleur )
          `)
          .eq('orderlijst_id', olId)
          .order('aangemaakt_op')

        orderlijsten.push({
          id: olId,
          naam: ol?.naam ?? olId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          regels: (regels ?? []).map((r: any) => ({
            id: r.id,
            categorie: r.categorie,
            aantal: r.aantal,
            ruimte_indeling: r.ruimte_indeling,
            ruimtes: Array.isArray(r.ruimtes) ? r.ruimtes : (r.ruimtes ? JSON.parse(r.ruimtes) : []),
            voegmethode: r.voegmethode,
            bewerkingen: Array.isArray(r.bewerkingen) ? r.bewerkingen : [],
            prijs_per_stuk: r.prijs_per_stuk,
            totaal_prijs: r.totaal_prijs,
            basisplaat: Array.isArray(r.basisplaat) ? r.basisplaat[0] ?? null : r.basisplaat,
            fineer_voor: Array.isArray(r.fineers_voor) ? r.fineers_voor[0] ?? null : r.fineers_voor,
            fineer_tegen: Array.isArray(r.fineers_tegen) ? r.fineers_tegen[0] ?? null : r.fineers_tegen,
            hpl_voor: Array.isArray(r.hpl_voor_data) ? r.hpl_voor_data[0] ?? null : r.hpl_voor_data,
            hpl_tegen: Array.isArray(r.hpl_tegen_data) ? r.hpl_tegen_data[0] ?? null : r.hpl_tegen_data,
          }))
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profiel = aanvraag.profiles as any
      const printDate = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' })
      const aanvraagDatum = aanvraag.verstuurd_op
        ? new Date(aanvraag.verstuurd_op).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—'

      const fmt = (n: number) => '€ ' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2 })


      const fkAdviesLabel = (advies: string | undefined): string => {
        const labels: Record<string, string> = {
          fabriek:      '📋 Fineerkeuze: <strong>Fabriek</strong> (standaard)',
          foto_kuiper:  '📷 Fineerkeuze: <strong>Foto Kuiper Holland</strong>',
          foto_klant:   '⚠️ Fineerkeuze: <strong>Foto klant</strong> — verplicht aanleveren',
          persoonlijk:  '🤝 Fineerkeuze: <strong>Persoonlijk overleg</strong> vereist',
        }
        return advies ? (labels[advies] ?? advies) : ''
      }
      const regelRows = orderlijsten.flatMap(ol =>
        ol.regels.map((r, idx) => {
          const bp = r.basisplaat
          const plaatNaam = bp ? `${bp.naam} — ${bp.dikte_mm}mm (${bp.breedte_mm}×${bp.lengte_mm}mm)` : '—'
          const afwerking = r.categorie === 'fineer'
            ? [r.fineer_voor?.naam ? `Voor: ${r.fineer_voor.naam}` : null, r.fineer_tegen?.naam ? `Tegen: ${r.fineer_tegen.naam}` : null].filter(Boolean).join(' | ')
            : r.categorie === 'hpl'
              ? [r.hpl_voor?.kleur ? `Voor: ${r.hpl_voor.kleur}` : null, r.hpl_tegen?.kleur ? `Tegen: ${r.hpl_tegen.kleur}` : null].filter(Boolean).join(' | ')
              : 'Kaal'
          const bewString = r.bewerkingen.length ? r.bewerkingen.map(bewNaam).join(', ') : '—'
          const fotoUrl = r.fineer_voor?.gallery_foto_url ?? r.hpl_voor?.gallery_foto_url ?? null
          const aantalStr = r.ruimte_indeling === 'per_ruimte' && r.ruimtes?.length
            ? r.ruimtes.map((ru: { naam: string; aantal: number }) => `${ru.naam}: ${ru.aantal}×`).join('<br>')
            : `${r.aantal}×`

          return `
            <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
              <td class="num">${idx + 1}</td>
              <td>
                <strong>${plaatNaam}</strong><br>
                <span class="sub">Categorie: ${r.categorie}</span>
                ${r.voegmethode ? `<br><span class="sub">Voeg: ${r.voegmethode}</span>` : ''}
              </td>
              <td>
                ${afwerking}
                ${fotoUrl ? `<br><img src="${fotoUrl}" alt="" class="thumb">` : ''}
              </td>
              <td class="bewerkingen">${bewString}</td>
              <td class="num">${aantalStr}</td>
              <td class="num money">${fmt(r.prijs_per_stuk)}</td>
              <td class="num money"><strong>${fmt(r.totaal_prijs)}</strong></td>
            </tr>
            ${ol !== orderlijsten[0] || idx !== 0 ? '' : `<!-- first row -->`}`
        }).join('')
      )

      // Group headers per orderlijst
      const sections = orderlijsten.map(ol => `
        <tr class="ol-header">
          <td colspan="7"><strong>📋 ${ol.naam}</strong> <span class="sub">(${ol.regels.length} regel${ol.regels.length !== 1 ? 's' : ''})</span></td>
        </tr>
        ${ol.regels.map((r, idx) => {
          const bp = r.basisplaat
          const plaatNaam = bp ? `${bp.naam} — ${bp.dikte_mm}mm (${bp.breedte_mm}×${bp.lengte_mm}mm)` : '—'
          const afwerking = r.categorie === 'fineer'
            ? [r.fineer_voor?.naam ? `Voor: ${r.fineer_voor.naam}` : null, r.fineer_tegen?.naam ? `Tegen: ${r.fineer_tegen.naam}` : null].filter(Boolean).join(' | ')
            : r.categorie === 'hpl'
              ? [r.hpl_voor?.kleur ? `Voor: ${r.hpl_voor.kleur}` : null, r.hpl_tegen?.kleur ? `Tegen: ${r.hpl_tegen.kleur}` : null].filter(Boolean).join(' | ')
              : 'Kaal'
          const bewString = r.bewerkingen.length ? r.bewerkingen.map(bewNaam).join(', ') : '—'
          const fotoUrl = r.fineer_voor?.gallery_foto_url ?? r.hpl_voor?.gallery_foto_url ?? null
          const aantalStr = r.ruimte_indeling === 'per_ruimte' && r.ruimtes?.length
            ? r.ruimtes.map((ru: { naam: string; aantal: number }) => `${ru.naam}: ${ru.aantal}×`).join('<br>')
            : `${r.aantal}×`
          const fkVoor = fkAdviesLabel(r.fineer_voor?.fk_advies)
          const fkTegen = r.fineer_tegen?.fk_advies && r.fineer_tegen.fk_advies !== r.fineer_voor?.fk_advies
            ? fkAdviesLabel(r.fineer_tegen.fk_advies) : ''
          return `
            <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
              <td class="num">${idx + 1}</td>
              <td>
                <strong>${plaatNaam}</strong><br>
                <span class="sub">Categorie: ${r.categorie}</span>
                ${r.voegmethode ? `<br><span class="sub">Voeg: ${r.voegmethode}</span>` : ''}
              </td>
              <td>
                ${afwerking}
                ${fkVoor ? `<br><span class="fk-advies">${fkVoor}</span>` : ''}
                ${fkTegen ? `<br><span class="fk-advies">${fkTegen}</span>` : ''}
                ${fotoUrl ? `<br><img src="${fotoUrl}" alt="" class="thumb" crossorigin="anonymous">` : ''}
              </td>
              <td>${bewString}</td>
              <td class="num">${aantalStr}</td>
              <td class="num money">${fmt(r.prijs_per_stuk)}</td>
              <td class="num money"><strong>${fmt(r.totaal_prijs)}</strong></td>
            </tr>`
        }).join('')}
      `).join('')

      const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>Aanvraag — ${orderlijsten.map(o => o.naam).join(', ')}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #8B6F47; padding-bottom: 16px; }
  .logo { font-size: 20px; font-weight: 700; color: #8B6F47; }
  .logo span { font-size: 24px; margin-right: 6px; }
  .meta { text-align: right; font-size: 10px; color: #666; }
  .meta strong { display: block; font-size: 14px; color: #1a1a1a; margin-bottom: 2px; }
  .klant-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .card { background: #f9f7f4; border: 1px solid #e8e0d5; border-radius: 6px; padding: 10px 14px; }
  .card h3 { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #8B6F47; margin-bottom: 6px; }
  .card p { margin-bottom: 2px; line-height: 1.5; }
  .bericht { background: #fffbf0; border: 1px solid #f0e8c8; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; }
  .bericht h3 { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #8B6F47; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10.5px; }
  thead tr { background: #8B6F47; color: white; }
  thead th { padding: 7px 8px; text-align: left; font-weight: 600; font-size: 10px; }
  thead th.num { text-align: center; }
  tbody tr.even { background: #fafafa; }
  tbody tr.odd { background: #fff; }
  tbody tr.ol-header { background: #f0ebe4; }
  tbody tr.ol-header td { padding: 6px 8px; font-size: 11px; color: #5c4a35; border-top: 2px solid #d4c4b0; }
  td { padding: 6px 8px; vertical-align: top; border-bottom: 1px solid #eee; }
  td.num { text-align: center; white-space: nowrap; }
  td.money { text-align: right; font-variant-numeric: tabular-nums; }
  .sub { color: #888; font-size: 9.5px; }
  .thumb { width: 56px; height: 42px; object-fit: cover; border-radius: 3px; margin-top: 4px; border: 1px solid #ddd; }
  .fk-advies { display: inline-block; margin-top: 4px; padding: 2px 6px; background: #fff8ec; border: 1px solid #f0d090; border-radius: 4px; font-size: 9px; color: #7a5200; line-height: 1.5; }
  .totaal-row td { border-top: 2px solid #8B6F47; font-size: 12px; padding: 8px; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 9px; color: #999; display: flex; justify-content: space-between; }
  @media print {
    body { padding: 0; }
    button { display: none; }
    @page { margin: 15mm 12mm; size: A4; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo"><span>🪵</span>Kuiper Holland</div>
      <div style="font-size:10px;color:#666;margin-top:4px;">Veneer &amp; HPL — Interieurbouw B2B</div>
    </div>
    <div class="meta">
      <strong>OFFERTE AANVRAAG</strong>
      Aanvraagdatum: ${aanvraagDatum}<br>
      Afgedrukt: ${printDate}<br>
      Ref: ${aanvraagId.slice(0, 8).toUpperCase()}
    </div>
  </div>

  <div class="klant-grid">
    <div class="card">
      <h3>Klantgegevens</h3>
      <p><strong>${profiel?.naam ?? '—'}</strong></p>
      <p>${profiel?.bedrijf ?? '—'}</p>
      ${profiel?.adres ? `<p>${profiel.adres}</p>` : ''}
      ${profiel?.kvk ? `<p>KvK: ${profiel.kvk}</p>` : ''}
      ${profiel?.email ? `<p>${profiel.email}</p>` : ''}
    </div>
    <div class="card">
      <h3>Aanvraaginfo</h3>
      <p><strong>Project${orderlijsten.length > 1 ? 'en' : ''}:</strong> ${orderlijsten.map(o => o.naam).join(', ')}</p>
      <p><strong>Type:</strong> Offerte aanvraag</p>
      <p><strong>Totaal:</strong> ${fmt(aanvraag.totaal_waarde ?? 0)}</p>
      ${aanvraag.fineerkeuze_tekst ? `<p><strong>Fineerkeuze:</strong> ${aanvraag.fineerkeuze_tekst}</p>` : ''}
    </div>
  </div>

  ${aanvraag.bericht ? `
  <div class="bericht">
    <h3>Bericht van klant</h3>
    <p>${aanvraag.bericht}</p>
  </div>` : ''}

  <table>
    <thead>
      <tr>
        <th class="num" style="width:28px">#</th>
        <th style="width:28%">Basisplaat</th>
        <th style="width:22%">Afwerking</th>
        <th style="width:18%">Bewerkingen</th>
        <th class="num" style="width:14%">Aantallen</th>
        <th class="num" style="width:9%">Stukprijs</th>
        <th class="num" style="width:9%">Totaal</th>
      </tr>
    </thead>
    <tbody>
      ${sections}
      <tr class="totaal-row">
        <td colspan="6" style="text-align:right"><strong>Totaal aanvraag</strong></td>
        <td class="num money"><strong>${fmt(aanvraag.totaal_waarde ?? 0)}</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <span>Kuiper Holland B.V. — Intern gebruik</span>
    <span>Afgedrukt op ${printDate}</span>
  </div>

  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`

      toast.dismiss(toastId)
      const win = window.open('', '_blank', 'width=900,height=700')
      if (win) {
        win.document.write(html)
        win.document.close()
      } else {
        toast.error('Pop-up geblokkeerd. Sta pop-ups toe voor deze site.')
      }
    } catch (err) {
      console.error(err)
      toast.error('Afdrukken mislukt', { id: toastId })
    }
  }

  // Prijzen state
  const [baseplaten, setBaseplaten] = useState<Baseplaat[]>(seedBaseplaten)
  const [fineers, setFineers] = useState<Fineer[]>(seedFineers)
  const [hplList, setHplList] = useState<HPL[]>(seedHPL)

  // CRUD modal state
  type ModalType = 'baseplaat' | 'fineer' | 'hpl' | null
  const [modalType, setModalType] = useState<ModalType>(null)
  const [modalItem, setModalItem] = useState<Baseplaat | Fineer | HPL | null>(null)

  // Baseplaat form
  const emptyBaseplaat = (): Omit<Baseplaat, 'id'> => ({
    naam: '', dikte_mm: 18, breedte_mm: 1220, lengte_mm: 2440,
    prijs_per_m2: 0, beschikbaar: true,
  })
  const [bpForm, setBpForm] = useState<Omit<Baseplaat, 'id'> & { gallery_foto_url?: string; volgorde?: number }>(
    { ...emptyBaseplaat(), gallery_foto_url: '', volgorde: 0 }
  )

  // Fineer form
  const emptyFineer = (): Omit<Fineer, 'id'> => ({
    naam: '', prijs_voorzijde_lang: 0, prijs_voorzijde_kort: 0,
    prijs_tegenzijde_lang: 0, prijs_tegenzijde_kort: 0,
    voegmethodes: [], voeg_standaard: '', fk_advies: 'fabriek',
    status_lang: 'beschikbaar', status_kort: 'beschikbaar',
    info: '', gallery_foto_url: '',
  })
  const [fnForm, setFnForm] = useState<Omit<Fineer, 'id'> & { volgorde?: number }>(
    { ...emptyFineer(), volgorde: 0 }
  )

  // HPL form
  const emptyHpl = (): Omit<HPL, 'id'> => ({
    kleur: '', prijs_lang: 0, prijs_kort: 0,
    hpl_afm_lang_b: 1310, hpl_afm_lang_l: 2800,
    hpl_afm_kort_b: 1310, hpl_afm_kort_l: 1300,
    status_lang: 'beschikbaar', status_kort: 'beschikbaar',
    info: '', gallery_foto_url: '',
  })
  const [hplForm, setHplForm] = useState<Omit<HPL, 'id'> & { volgorde?: number }>(
    { ...emptyHpl(), volgorde: 0 }
  )

  const VOEGMETHODE_OPTIONS = ['gestolpt', 'mixmatch', 'geschoven', 'gedraaid_geschoven']

  function openAdd(type: ModalType) {
    setModalType(type)
    setModalItem(null)
    if (type === 'baseplaat') setBpForm({ ...emptyBaseplaat(), gallery_foto_url: '', volgorde: baseplaten.length + 1 })
    if (type === 'fineer') setFnForm({ ...emptyFineer(), volgorde: fineers.length + 1 })
    if (type === 'hpl') setHplForm({ ...emptyHpl(), volgorde: hplList.length + 1 })
  }

  function openEdit(type: ModalType, item: Baseplaat | Fineer | HPL) {
    setModalType(type)
    setModalItem(item)
    if (type === 'baseplaat') {
      const p = item as Baseplaat & { gallery_foto_url?: string; volgorde?: number }
      setBpForm({ naam: p.naam, dikte_mm: p.dikte_mm, breedte_mm: p.breedte_mm, lengte_mm: p.lengte_mm,
        prijs_per_m2: p.prijs_per_m2, beschikbaar: p.beschikbaar, gallery_foto_url: p.gallery_foto_url ?? '', volgorde: p.volgorde ?? 0 })
    }
    if (type === 'fineer') {
      const f = item as Fineer & { volgorde?: number }
      setFnForm({ naam: f.naam, prijs_voorzijde_lang: f.prijs_voorzijde_lang, prijs_voorzijde_kort: f.prijs_voorzijde_kort,
        prijs_tegenzijde_lang: f.prijs_tegenzijde_lang, prijs_tegenzijde_kort: f.prijs_tegenzijde_kort,
        voegmethodes: [...f.voegmethodes], voeg_standaard: f.voeg_standaard, fk_advies: f.fk_advies,
        status_lang: f.status_lang, status_kort: f.status_kort, info: f.info ?? '', gallery_foto_url: f.gallery_foto_url ?? '',
        volgorde: f.volgorde ?? 0 })
    }
    if (type === 'hpl') {
      const h = item as HPL & { volgorde?: number }
      setHplForm({ kleur: h.kleur, prijs_lang: h.prijs_lang, prijs_kort: h.prijs_kort,
        hpl_afm_lang_b: h.hpl_afm_lang_b, hpl_afm_lang_l: h.hpl_afm_lang_l,
        hpl_afm_kort_b: h.hpl_afm_kort_b, hpl_afm_kort_l: h.hpl_afm_kort_l,
        status_lang: h.status_lang, status_kort: h.status_kort, info: h.info ?? '', gallery_foto_url: h.gallery_foto_url ?? '',
        volgorde: h.volgorde ?? 0 })
    }
  }

  async function loadBaseplaten() {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase.from('baseplaten').select('*').order('volgorde', { ascending: true })
      if (data && data.length > 0) setBaseplaten(data as Baseplaat[])
    } catch { /* keep current */ }
  }

  async function loadFineers() {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase.from('fineers').select('*').order('volgorde', { ascending: true })
      if (data && data.length > 0) setFineers(data as Fineer[])
    } catch { /* keep current */ }
  }

  async function loadHpl() {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase.from('hpl').select('*').order('volgorde', { ascending: true })
      if (data && data.length > 0) setHplList(data as HPL[])
    } catch { /* keep current */ }
  }

  async function saveBaseplaat() {
    if (!bpForm.naam) { toast.error('Naam is verplicht'); return }
    const toastId = toast.loading('Opslaan…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const payload = modalItem
        ? { id: modalItem.id, ...bpForm }
        : { ...bpForm }
      const { error } = await supabase.from('baseplaten').upsert(payload as Record<string, unknown>)
      if (error) { toast.error('Fout: ' + error.message, { id: toastId }); return }
      toast.success(modalItem ? 'Basisplaat bijgewerkt' : 'Basisplaat toegevoegd', { id: toastId })
      setModalType(null)
      await loadBaseplaten()
    } catch (e) {
      toast.error('Opslaan mislukt', { id: toastId })
      console.error(e)
    }
  }

  async function deleteBaseplaat(id: string) {
    if (!window.confirm('Weet je zeker dat je deze basisplaat wilt verwijderen?')) return
    const toastId = toast.loading('Verwijderen…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.from('baseplaten').delete().eq('id', id)
      if (error) { toast.error('Fout: ' + error.message, { id: toastId }); return }
      toast.success('Basisplaat verwijderd', { id: toastId })
      await loadBaseplaten()
    } catch (e) {
      toast.error('Verwijderen mislukt', { id: toastId })
      console.error(e)
    }
  }

  async function saveFineer() {
    if (!fnForm.naam) { toast.error('Naam is verplicht'); return }
    const toastId = toast.loading('Opslaan…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const payload = modalItem
        ? { id: modalItem.id, ...fnForm }
        : { ...fnForm }
      const { error } = await supabase.from('fineers').upsert(payload as Record<string, unknown>)
      if (error) { toast.error('Fout: ' + error.message, { id: toastId }); return }
      toast.success(modalItem ? 'Fineer bijgewerkt' : 'Fineer toegevoegd', { id: toastId })
      setModalType(null)
      await loadFineers()
    } catch (e) {
      toast.error('Opslaan mislukt', { id: toastId })
      console.error(e)
    }
  }

  async function deleteFineer(id: string) {
    if (!window.confirm('Weet je zeker dat je dit fineer wilt verwijderen?')) return
    const toastId = toast.loading('Verwijderen…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.from('fineers').delete().eq('id', id)
      if (error) { toast.error('Fout: ' + error.message, { id: toastId }); return }
      toast.success('Fineer verwijderd', { id: toastId })
      await loadFineers()
    } catch (e) {
      toast.error('Verwijderen mislukt', { id: toastId })
      console.error(e)
    }
  }

  async function saveHpl() {
    if (!hplForm.kleur) { toast.error('Kleur is verplicht'); return }
    const toastId = toast.loading('Opslaan…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const payload = modalItem
        ? { id: modalItem.id, ...hplForm }
        : { ...hplForm }
      const { error } = await supabase.from('hpl').upsert(payload as Record<string, unknown>)
      if (error) { toast.error('Fout: ' + error.message, { id: toastId }); return }
      toast.success(modalItem ? 'HPL bijgewerkt' : 'HPL toegevoegd', { id: toastId })
      setModalType(null)
      await loadHpl()
    } catch (e) {
      toast.error('Opslaan mislukt', { id: toastId })
      console.error(e)
    }
  }

  async function deleteHpl(id: string) {
    if (!window.confirm('Weet je zeker dat je dit HPL wilt verwijderen?')) return
    const toastId = toast.loading('Verwijderen…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.from('hpl').delete().eq('id', id)
      if (error) { toast.error('Fout: ' + error.message, { id: toastId }); return }
      toast.success('HPL verwijderd', { id: toastId })
      await loadHpl()
    } catch (e) {
      toast.error('Verwijderen mislukt', { id: toastId })
      console.error(e)
    }
  }

  async function savePrijzen() {
    const toastId = toast.loading('Prijzen opslaan…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const results = await Promise.all([
        ...baseplaten.map(p =>
          supabase.from('baseplaten')
            .update({ prijs_per_m2: p.prijs_per_m2, beschikbaar: p.beschikbaar })
            .eq('id', p.id)
        ),
        ...fineers.map(f =>
          supabase.from('fineers')
            .update({
              prijs_voorzijde_lang: f.prijs_voorzijde_lang,
              prijs_voorzijde_kort: f.prijs_voorzijde_kort,
              prijs_tegenzijde_lang: f.prijs_tegenzijde_lang,
              prijs_tegenzijde_kort: f.prijs_tegenzijde_kort,
              fk_advies: f.fk_advies,
            })
            .eq('id', f.id)
        ),
        ...hplList.map(h =>
          supabase.from('hpl')
            .update({ prijs_lang: h.prijs_lang, prijs_kort: h.prijs_kort })
            .eq('id', h.id)
        ),
      ])

      const failed = results.filter(r => r.error)
      if (failed.length > 0) {
        console.error('Prijzen opslaan fouten:', failed.map(r => r.error))
        toast.error(`${failed.length} prijs(zen) konden niet worden opgeslagen`, { id: toastId })
        return
      }
      toast.success('Prijzen opgeslagen', { id: toastId })
    } catch (e) {
      toast.error('Opslaan mislukt', { id: toastId })
      console.error(e)
    }
  }

  async function saveStaffel() {
    const toastId = toast.loading('Staffel opslaan…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const upserts = [
        { sleutel: 'staffel_fineer_hpl', waarde: JSON.stringify(staffelFH) },
        { sleutel: 'staffel_kaal', waarde: JSON.stringify(staffelKaal) },
        { sleutel: 'verzend_drempel', waarde: String(verzendDrempel) },
        { sleutel: 'verzend_kosten', waarde: String(verzendKosten) },
      ]
      const { error } = await supabase.from('instellingen').upsert(upserts, { onConflict: 'sleutel' })
      if (error) { toast.error('Fout: ' + error.message, { id: toastId }); return }
      toast.success('Staffel opgeslagen', { id: toastId })
    } catch (e) { toast.error('Opslaan mislukt', { id: toastId }); console.error(e) }
  }

  async function saveVasteKosten() {
    const toastId = toast.loading('Opslaan…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const upserts = [
        { sleutel: 'fineerlijm_per_m2', waarde: String(fineerlijm) },
        { sleutel: 'schuurbanden_per_m2', waarde: String(schuurbanden) },
        { sleutel: 'hpl_lijm_per_m2', waarde: String(hplLijm) },
        { sleutel: 'pu_hotmelt_per_m2', waarde: String(puHotmelt) },
      ]
      const { error } = await supabase.from('instellingen').upsert(upserts, { onConflict: 'sleutel' })
      if (error) { toast.error('Fout: ' + error.message, { id: toastId }); return }
      toast.success('Vaste kosten opgeslagen', { id: toastId })
    } catch (e) { toast.error('Opslaan mislukt', { id: toastId }); console.error(e) }
  }

  async function saveHotmeltComb(basisplaat_id: string, categorie: 'fineer' | 'hpl') {
    const toastId = toast.loading('Opslaan…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data, error } = await supabase.from('hotmelt_combinaties')
        .insert({ basisplaat_id, categorie })
        .select().single()
      if (error) { toast.error('Fout: ' + error.message, { id: toastId }); return }
      setHotmeltCombs(h => [...h, data as HotmeltCombinatie])
      toast.success('Combinatie toegevoegd', { id: toastId })
    } catch (e) { toast.error('Fout', { id: toastId }); console.error(e) }
  }

  async function deleteHotmeltComb(id: string) {
    if (!window.confirm('Hotmelt combinatie verwijderen?')) return
    const toastId = toast.loading('Verwijderen…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.from('hotmelt_combinaties').delete().eq('id', id)
      if (error) { toast.error('Fout: ' + error.message, { id: toastId }); return }
      setHotmeltCombs(h => h.filter(x => x.id !== id))
      toast.success('Verwijderd', { id: toastId })
    } catch (e) { toast.error('Fout', { id: toastId }); console.error(e) }
  }

  // Staffel state
  const [staffelFH, setStaffelFH] = useState<StaffelRegel[]>(seedStaffelFineerHPL)
  const [staffelKaal, setStaffelKaal] = useState<StaffelRegel[]>(seedStaffelKaal)
  const [verzendDrempel, setVerzendDrempel] = useState(
    parseFloat(seedInstellingen.find(i => i.sleutel === 'verzend_drempel')?.waarde ?? '1750')
  )
  const [verzendKosten, setVerzendKosten] = useState(
    parseFloat(seedInstellingen.find(i => i.sleutel === 'verzend_kosten')?.waarde ?? '25')
  )

  // Bewerkingen state
  const [bewerkingen, setBewerkingen] = useState<Bewerking[]>(seedBewerkingen)
  const [fineerlijm, setFineerlijm] = useState(seedVasteKosten.fineerlijm_per_m2)
  const [schuurbanden, setSchuurbanden] = useState(seedVasteKosten.schuurbanden_per_m2)
  const [hplLijm, setHplLijm] = useState(seedVasteKosten.hpl_lijm_per_m2)
  const [puHotmelt, setPuHotmelt] = useState(seedVasteKosten.pu_hotmelt_per_m2)
  const [hotmeltCombs, setHotmeltCombs] = useState<HotmeltCombinatie[]>([])
  const [hmForm, setHmForm] = useState({ basisplaat_id: '', categorie: 'fineer' as 'fineer' | 'hpl' })

  // Uitsluitingen state
  const [uitsluitingen, setUitsluitingen] = useState<UitsluitingRow[]>([])

  // Uitsluiting modal state
  const emptyUitForm = { subject_type: 'basisplaat', subject_id: '', uitgesloten_type: 'bewerking', uitgesloten_id: '', reden: '' }
  const [uitModal, setUitModal] = useState<{ open: boolean; form: typeof emptyUitForm }>({ open: false, form: emptyUitForm })

  // Insluitingen state
  const [insluitingen, setInsluitingen] = useState<InsluitingRow[]>([])

  // Insluiting modal state
  const emptyInsForm = { subject_type: 'basisplaat', subject_id: '', ingesloten_type: 'bewerking', ingesloten_id: '', reden: '' }
  const [insModal, setInsModal] = useState<{ open: boolean; form: typeof emptyInsForm }>({ open: false, form: emptyInsForm })
  const emptyBw = { naam: '', beschrijving: '', prijs: 0, prijs_type: 'per_m2' as 'per_m2' | 'per_order', compatibiliteit: ['kaal', 'fineer', 'hpl'] as string[], beschikbaar: true, standaard_geselecteerd: false, volgorde: 0 }
  const [bwModal, setBwModal] = useState<{ open: boolean; item: Bewerking | null; form: typeof emptyBw }>({ open: false, item: null, form: emptyBw })

  // Aanvragen sub-tab
  const [aanvraagSubTab, setAanvraagSubTab] = useState<'definitief' | 'concepten'>('definitief')

  // Concept inzien modal
  const [conceptModal, setConceptModal] = useState<{
    open: boolean
    naam: string
    klant: string
    regels: { id: string; categorie: string; plaatNaam: string; afwerking: string; aantal: number; totaal_prijs: number | null }[]
    loading: boolean
  }>({ open: false, naam: '', klant: '', regels: [], loading: false })

  async function openConceptModal(conceptId: string, naam: string, klant: string) {
    setConceptModal({ open: true, naam, klant, regels: [], loading: true })
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
      setConceptModal(v => ({ ...v, loading: false }))
      return
    }
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data } = await supabase
      .from('orderlijst_regels')
      .select(`
        id, categorie, aantal, totaal_prijs,
        baseplaten ( naam, dikte_mm ),
        fineers_voor:fineers!orderlijst_regels_fineer_voor_fkey ( naam ),
        fineers_tegen:fineers!orderlijst_regels_fineer_tegen_fkey ( naam ),
        hpl_voor_data:hpl!orderlijst_regels_hpl_voor_fkey ( kleur ),
        hpl_tegen_data:hpl!orderlijst_regels_hpl_tegen_fkey ( kleur )
      `)
      .eq('orderlijst_id', conceptId)
      .order('id')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regels = (data ?? []).map((r: any) => {
      const plaatNaam = `${r.baseplaten?.naam ?? '—'} ${r.baseplaten?.dikte_mm ?? ''}mm`
      const afwerking = r.categorie === 'fineer'
        ? `Fineer: ${r.fineers_voor?.naam ?? '—'} / ${r.fineers_tegen?.naam ?? '—'}`
        : r.categorie === 'hpl'
        ? `HPL: ${r.hpl_voor_data?.kleur ?? '—'} / ${r.hpl_tegen_data?.kleur ?? '—'}`
        : 'Kaal'
      return { id: r.id, categorie: r.categorie, plaatNaam, afwerking, aantal: r.aantal, totaal_prijs: r.totaal_prijs }
    })
    setConceptModal(v => ({ ...v, regels, loading: false }))
  }

  // Klant-profiel modal
  const [klantProfiel, setKlantProfiel] = useState<{
    open: boolean
    loading: boolean
    data: {
      id: string; naam: string; email: string; telefoon: string | null
      bedrijf: string; kvk: string | null; branche: string | null; adres: string | null
      rol: string; status: string; aangemaakt_op: string; last_seen_at: string | null
      order_confirm_email: string | null; order_confirm_email_cc: string | null
    } | null
    clicks: number
    savingRol: boolean
    nieuwRol: string
  }>({ open: false, loading: false, data: null, clicks: 0, savingRol: false, nieuwRol: '' })

  async function openKlantProfiel(klantId: string) {
    const klantRow = klanten.find(k => k.id === klantId)
    setKlantProfiel({ open: true, loading: true, data: null, clicks: klantRow?.clicks ?? 0, savingRol: false, nieuwRol: klantRow?.rol ?? 'kijker' })
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
      setKlantProfiel(v => ({ ...v, loading: false }))
      return
    }
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('id, naam, email, telefoon, bedrijf, kvk, branche, adres, rol, status, aangemaakt_op, last_seen_at, order_confirm_email, order_confirm_email_cc')
      .eq('id', klantId)
      .single()
    setKlantProfiel(v => ({ ...v, loading: false, data: data ?? null, nieuwRol: data?.rol ?? v.nieuwRol }))
  }

  async function saveKlantRol() {
    const { data, nieuwRol } = klantProfiel
    if (!data) return
    setKlantProfiel(v => ({ ...v, savingRol: true }))
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl && supabaseUrl !== 'https://your-project.supabase.co') {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.from('profiles').update({ rol: nieuwRol }).eq('id', data.id)
      if (error) { toast.error('Opslaan mislukt: ' + error.message); setKlantProfiel(v => ({ ...v, savingRol: false })); return }
      setKlanten(list => list.map(k => k.id === data.id ? { ...k, rol: nieuwRol } : k))
      setKlantProfiel(v => ({ ...v, data: { ...v.data!, rol: nieuwRol }, savingRol: false }))
    }
    toast.success('Rol opgeslagen')
    setKlantProfiel(v => ({ ...v, savingRol: false }))
  }

  const TABS: { id: AdminTab; label: string }[] = [
    { id: 'aanmeldingen', label: 'Aanmeldingen' },
    { id: 'klanten', label: 'Klanten' },
    { id: 'aanvragen', label: 'Aanvragen' },
    { id: 'prijzen', label: 'Prijzen' },
    { id: 'staffel', label: 'Staffel' },
    { id: 'galerij_basisplaat', label: 'Galerij Basisplaat' },
    { id: 'galerij_fineer', label: 'Galerij Fineer' },
    { id: 'galerij_hpl', label: 'Galerij HPL' },
    { id: 'bewerkingen', label: 'Bewerkingen' },
    { id: 'uitsluitingen', label: 'Uitsluitingen' },
    { id: 'insluitingen', label: 'Insluitingen' },
  ]

  async function approveAanmelding(id: string) {
    const gekozenRol = rolKeuzes[id] ?? 'kijker'
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (supabaseUrl && supabaseUrl !== 'https://your-project.supabase.co') {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { error } = await supabase
          .from('profiles')
          .update({ status: 'goedgekeurd', rol: gekozenRol })
          .eq('id', id)
        if (error) { toast.error('Opslaan mislukt: ' + error.message); return }
      }
    } catch { /* ignore network errors in demo */ }
    setAanmeldingen(a => a.filter(x => x.id !== id))
    toast.success('Aanmelding goedgekeurd als ' + gekozenRol)
  }

  async function rejectAanmelding(id: string) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (supabaseUrl && supabaseUrl !== 'https://your-project.supabase.co') {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        await supabase.from('profiles').update({ status: 'afgewezen' }).eq('id', id)
      }
    } catch { /* ignore */ }
    setAanmeldingen(a => a.filter(x => x.id !== id))
    toast.error('Aanmelding afgewezen')
  }

  function toggleKlantStatus(id: string) {
    setKlanten(k => k.map(x => x.id === id
      ? { ...x, status: x.status === 'goedgekeurd' ? 'gedeactiveerd' : 'goedgekeurd' }
      : x
    ))
  }

  function addStaffelRow(type: 'fh' | 'kaal') {
    const newRow: StaffelRegel = { id: `sr-${Date.now()}`, van_aantal: 0, tot_aantal: null, marge_coefficient: 0.65 }
    if (type === 'fh') setStaffelFH(s => [...s, newRow])
    else setStaffelKaal(s => [...s, newRow])
  }

  function removeStaffelRow(type: 'fh' | 'kaal', id: string) {
    if (type === 'fh') setStaffelFH(s => s.filter(r => r.id !== id))
    else setStaffelKaal(s => s.filter(r => r.id !== id))
  }

  function openBwAdd() {
    setBwModal({ open: true, item: null, form: { ...emptyBw, volgorde: bewerkingen.length + 1 } })
  }

  function openBwEdit(b: Bewerking) {
    setBwModal({ open: true, item: b, form: { naam: b.naam, beschrijving: b.beschrijving, prijs: b.prijs, compatibiliteit: [...b.compatibiliteit], beschikbaar: b.beschikbaar, standaard_geselecteerd: b.standaard_geselecteerd ?? false, volgorde: b.volgorde } })
  }

  async function saveBw() {
    const { form, item } = bwModal
    if (!form.naam) { toast.error('Naam is verplicht'); return }
    const toastId = toast.loading('Opslaan…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      if (item) {
        const { error } = await supabase.from('bewerkingen').update({ naam: form.naam, beschrijving: form.beschrijving, prijs: form.prijs, prijs_type: form.prijs_type, compatibiliteit: form.compatibiliteit, beschikbaar: form.beschikbaar, standaard_geselecteerd: form.standaard_geselecteerd, volgorde: form.volgorde }).eq('id', item.id)
        if (error) { toast.error('Opslaan mislukt: ' + error.message, { id: toastId }); return }
        setBewerkingen(b => b.map(x => x.id === item.id ? { ...x, ...form } as Bewerking : x))
      } else {
        const { data, error } = await supabase.from('bewerkingen').insert({ naam: form.naam, beschrijving: form.beschrijving, prijs: form.prijs, prijs_type: form.prijs_type, compatibiliteit: form.compatibiliteit, beschikbaar: form.beschikbaar, standaard_geselecteerd: form.standaard_geselecteerd, volgorde: form.volgorde }).select().single()
        if (error) { toast.error('Toevoegen mislukt: ' + error.message, { id: toastId }); return }
        setBewerkingen(b => [...b, data as Bewerking])
      }
      toast.success(item ? 'Bewerking bijgewerkt' : 'Bewerking toegevoegd', { id: toastId })
      setBwModal({ open: false, item: null, form: emptyBw })
    } catch (e) { toast.error('Fout', { id: toastId }); console.error(e) }
  }

  async function deleteBw(b: Bewerking) {
    if (!window.confirm(`Bewerking "${b.naam}" definitief verwijderen?`)) return
    const toastId = toast.loading('Verwijderen…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.from('bewerkingen').delete().eq('id', b.id)
      if (error) { toast.error('Verwijderen mislukt: ' + error.message, { id: toastId }); return }
      setBewerkingen(bw => bw.filter(x => x.id !== b.id))
      toast.success('Verwijderd', { id: toastId })
    } catch (e) { toast.error('Fout', { id: toastId }); console.error(e) }
  }

  async function toggleBewerking(id: string) {
    const bw = bewerkingen.find(x => x.id === id)
    if (!bw) return
    const next = !bw.beschikbaar
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase.from('bewerkingen').update({ beschikbaar: next }).eq('id', id)
      setBewerkingen(b => b.map(x => x.id === id ? { ...x, beschikbaar: next } : x))
    } catch { toast.error('Opslaan mislukt') }
  }

  function resolveNaam(type: string, id: string): string {
    if (type === 'basisplaat') return baseplaten.find(x => x.id === id)?.naam ?? id
    if (type === 'fineer') return fineers.find(x => x.id === id)?.naam ?? id
    if (type === 'hpl') return hplList.find(x => x.id === id)?.kleur ?? id
    if (type === 'bewerking') return bewerkingen.find(x => x.id === id)?.naam ?? id
    return id
  }

  async function loadUitsluitingen() {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase.from('uitsluitingen').select('*')
      if (data) setUitsluitingen(data as UitsluitingRow[])
    } catch { /* keep current */ }
  }

  async function loadInsluitingen() {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase.from('insluitingen').select('*')
      if (data) setInsluitingen(data as InsluitingRow[])
    } catch { /* keep current */ }
  }

  async function saveUitsluiting() {
    const { form } = uitModal
    if (!form.subject_id || !form.uitgesloten_id) { toast.error('Selecteer beide items'); return }
    if (form.subject_id === form.uitgesloten_id && form.subject_type === form.uitgesloten_type) {
      toast.error('Subject en uitgeslotene mogen niet hetzelfde zijn'); return
    }
    const toastId = toast.loading('Opslaan…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.from('uitsluitingen').insert({
        subject_type: form.subject_type,
        subject_id: form.subject_id,
        uitgesloten_type: form.uitgesloten_type,
        uitgesloten_id: form.uitgesloten_id,
        reden: form.reden || null,
      })
      if (error) { toast.error('Opslaan mislukt: ' + error.message, { id: toastId }); return }
      toast.success('Uitsluiting toegevoegd', { id: toastId })
      setUitModal({ open: false, form: emptyUitForm })
      await loadUitsluitingen()
    } catch (e) { toast.error('Fout', { id: toastId }); console.error(e) }
  }

  async function deleteUitsluiting(id: string) {
    if (!window.confirm('Uitsluiting verwijderen?')) return
    const toastId = toast.loading('Verwijderen…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.from('uitsluitingen').delete().eq('id', id)
      if (error) { toast.error('Verwijderen mislukt: ' + error.message, { id: toastId }); return }
      toast.success('Verwijderd', { id: toastId })
      await loadUitsluitingen()
    } catch (e) { toast.error('Fout', { id: toastId }); console.error(e) }
  }

  async function saveInsluiting() {
    const { form } = insModal
    if (!form.subject_id || !form.ingesloten_id) { toast.error('Selecteer beide items'); return }
    if (form.subject_id === form.ingesloten_id && form.subject_type === form.ingesloten_type) {
      toast.error('Subject en ingeslotene mogen niet hetzelfde zijn'); return
    }
    const toastId = toast.loading('Opslaan…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.from('insluitingen').insert({
        subject_type: form.subject_type,
        subject_id: form.subject_id,
        ingesloten_type: form.ingesloten_type,
        ingesloten_id: form.ingesloten_id,
        reden: form.reden || null,
      })
      if (error) { toast.error('Opslaan mislukt: ' + error.message, { id: toastId }); return }
      toast.success('Insluiting toegevoegd', { id: toastId })
      setInsModal({ open: false, form: emptyInsForm })
      await loadInsluitingen()
    } catch (e) { toast.error('Fout', { id: toastId }); console.error(e) }
  }

  async function deleteInsluiting(id: string) {
    if (!window.confirm('Insluiting verwijderen?')) return
    const toastId = toast.loading('Verwijderen…')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.from('insluitingen').delete().eq('id', id)
      if (error) { toast.error('Verwijderen mislukt: ' + error.message, { id: toastId }); return }
      toast.success('Verwijderd', { id: toastId })
      await loadInsluitingen()
    } catch (e) { toast.error('Fout', { id: toastId }); console.error(e) }
  }

  function getItemsForType(type: string): { id: string; label: string }[] {
    if (type === 'basisplaat') return baseplaten.map(x => ({ id: x.id, label: x.naam }))
    if (type === 'fineer') return fineers.map(x => ({ id: x.id, label: x.naam }))
    if (type === 'hpl') return hplList.map(x => ({ id: x.id, label: x.kleur }))
    if (type === 'bewerking') return bewerkingen.map(x => ({ id: x.id, label: x.naam }))
    return []
  }

  function exportPrijzenCsv(type: 'baseplaten' | 'fineers' | 'hpl') {
    function cell(val: unknown): string {
      if (val === null || val === undefined) return ''
      if (typeof val === 'number') return String(val)
      if (typeof val === 'boolean') return val ? 'true' : 'false'
      const s = String(val)
      return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s
    }
    let rows: Record<string, unknown>[]
    let filename: string
    if (type === 'baseplaten') {
      rows = baseplaten.map(p => ({ id: p.id, naam: p.naam, dikte_mm: p.dikte_mm, breedte_mm: p.breedte_mm, lengte_mm: p.lengte_mm, prijs_per_m2: p.prijs_per_m2, beschikbaar: p.beschikbaar }))
      filename = 'baseplaten_prijzen.csv'
    } else if (type === 'fineers') {
      rows = fineers.map(f => ({ id: f.id, naam: f.naam, prijs_voorzijde_lang: f.prijs_voorzijde_lang, prijs_voorzijde_kort: f.prijs_voorzijde_kort, prijs_tegenzijde_lang: f.prijs_tegenzijde_lang, prijs_tegenzijde_kort: f.prijs_tegenzijde_kort }))
      filename = 'fineers_prijzen.csv'
    } else {
      rows = hplList.map(h => ({ id: h.id, kleur: h.kleur, prijs_lang: h.prijs_lang, prijs_kort: h.prijs_kort, hpl_afm_lang_b: h.hpl_afm_lang_b, hpl_afm_lang_l: h.hpl_afm_lang_l, hpl_afm_kort_b: h.hpl_afm_kort_b, hpl_afm_kort_l: h.hpl_afm_kort_l }))
      filename = 'hpl_prijzen.csv'
    }
    if (!rows.length) { toast.error('Geen data om te exporteren'); return }
    const keys = Object.keys(rows[0])
    const csv = [keys.join(','), ...rows.map(row => keys.map(k => cell(row[k])).join(','))].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
    toast.success(`${filename} geëxporteerd`)
  }

  function importPrijzenCsv(type: 'baseplaten' | 'fineers' | 'hpl', content: string) {
    const lines = content.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) { toast.error('CSV bevat geen data'); return }
    const sep = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''))
    if (!headers.includes('id')) { toast.error('CSV mist kolom "id"'); return }

    const parsedRows = lines.slice(1).map(line => {
      const vals = sep === ';' ? line.split(';') : (line.match(/("(?:[^"]|"")*"|[^,]*)/g) ?? [])
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').replace(/^"|"$/g, '').replace(/""/g, '"').trim() })
      return obj
    })

    async function applyImport() {
      const toastId = toast.loading('Importeren…')
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        let updated = 0; let skipped = 0

        if (type === 'baseplaten') {
          const priceFields = ['prijs_per_m2', 'beschikbaar']
          for (const row of parsedRows) {
            if (!row.id) { skipped++; continue }
            const patch: Record<string, unknown> = {}
            if (row.prijs_per_m2 !== undefined) {
              const v = parseFloat(row.prijs_per_m2)
              if (!isNaN(v)) patch.prijs_per_m2 = v
            }
            if (row.beschikbaar !== undefined) {
              patch.beschikbaar = row.beschikbaar.toLowerCase() === 'true' || row.beschikbaar === '1'
            }
            if (Object.keys(patch).length === 0 || !priceFields.some(f => row[f] !== undefined)) { skipped++; continue }
            const { error } = await supabase.from('baseplaten').update(patch).eq('id', row.id)
            if (error) { skipped++ } else { updated++; setBaseplaten(b => b.map(x => x.id === row.id ? { ...x, ...patch } : x)) }
          }
        } else if (type === 'fineers') {
          for (const row of parsedRows) {
            if (!row.id) { skipped++; continue }
            const patch: Record<string, unknown> = {}
            for (const f of ['prijs_voorzijde_lang', 'prijs_voorzijde_kort', 'prijs_tegenzijde_lang', 'prijs_tegenzijde_kort'] as const) {
              if (row[f] !== undefined) { const v = parseFloat(row[f]); if (!isNaN(v)) patch[f] = v }
            }
            if (Object.keys(patch).length === 0) { skipped++; continue }
            const { error } = await supabase.from('fineers').update(patch).eq('id', row.id)
            if (error) { skipped++ } else { updated++; setFineers(f => f.map(x => x.id === row.id ? { ...x, ...patch } as Fineer : x)) }
          }
        } else {
          for (const row of parsedRows) {
            if (!row.id) { skipped++; continue }
            const patch: Record<string, unknown> = {}
            for (const f of ['prijs_lang', 'prijs_kort', 'hpl_afm_lang_b', 'hpl_afm_lang_l', 'hpl_afm_kort_b', 'hpl_afm_kort_l'] as const) {
              if (row[f] !== undefined) { const v = parseFloat(row[f]); if (!isNaN(v)) patch[f] = v }
            }
            if (Object.keys(patch).length === 0) { skipped++; continue }
            const { error } = await supabase.from('hpl').update(patch).eq('id', row.id)
            if (error) { skipped++ } else { updated++; setHplList(h => h.map(x => x.id === row.id ? { ...x, ...patch } as HPL : x)) }
          }
        }
        toast.success(`Import klaar: ${updated} bijgewerkt${skipped ? `, ${skipped} overgeslagen` : ''}`, { id: toastId })
      } catch (e) { toast.error('Import mislukt', { id: toastId }); console.error(e) }
    }
    applyImport()
  }

  function triggerImport(type: 'baseplaten' | 'fineers' | 'hpl') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,text/csv'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = e => importPrijzenCsv(type, e.target?.result as string)
      reader.readAsText(file, 'utf-8')
    }
    input.click()
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-gray-500 text-sm">Gegevens laden…</div>
      </div>
    )
  }

  return (
    <>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-xl font-bold text-gray-800">Beheerpaneel</h1>
        <Badge variant="info">Admin</Badge>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors
              ${activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'}`}
          >
            {tab.label}
            {tab.id === 'aanmeldingen' && aanmeldingen.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{aanmeldingen.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {/* ─── AANMELDINGEN ─── */}
        {activeTab === 'aanmeldingen' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Nieuwe aanmeldingen</h2>
            {aanmeldingen.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-sm">Geen openstaande aanmeldingen</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Naam</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Bedrijf</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">E-mail</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Datum</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Rol toekennen</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Actie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aanmeldingen.map(a => (
                      <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-3 font-medium text-gray-800">{a.naam}</td>
                        <td className="py-3 px-3 text-gray-600">{a.bedrijf}</td>
                        <td className="py-3 px-3 text-gray-500">{a.email}</td>
                        <td className="py-3 px-3 text-gray-400">{a.datum}</td>
                        <td className="py-3 px-3">
                          <select
                            value={rolKeuzes[a.id]}
                            onChange={e => setRolKeuzes(r => ({ ...r, [a.id]: e.target.value }))}
                            className="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none"
                          >
                            <option value="kijker">Kijker</option>
                            <option value="calculator">Calculator</option>
                            <option value="inkoper">Inkoper</option>
                          </select>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => approveAanmelding(a.id)}
                              className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
                            >
                              Goedkeuren
                            </button>
                            <button
                              onClick={() => rejectAanmelding(a.id)}
                              className="px-3 py-1 bg-red-100 text-red-600 text-xs font-medium rounded-lg hover:bg-red-200"
                            >
                              Afwijzen
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── KLANTEN ─── */}
        {activeTab === 'klanten' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Klantenbeheer</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Naam</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Bedrijf</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Rol</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Laatste sessie</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600" title="Aantal orderlijsten + aanvragen">Activiteit</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {klanten.map(k => (
                    <tr key={k.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium text-gray-800">{k.naam}</td>
                      <td className="py-3 px-3 text-gray-600">{k.bedrijf}</td>
                      <td className="py-3 px-3">
                        <Badge variant={k.rol === 'inkoper' ? 'approved' : k.rol === 'calculator' ? 'info' : 'inactive'}>
                          {k.rol}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <button onClick={() => toggleKlantStatus(k.id)}>
                          <Badge variant={k.status === 'goedgekeurd' ? 'active' : 'inactive'}>
                            {k.status}
                          </Badge>
                        </button>
                      </td>
                      <td className="py-3 px-3 text-gray-400 text-xs">{k.last_seen}</td>
                      <td className="py-3 px-3 text-gray-600">{k.clicks}</td>
                      <td className="py-3 px-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleKlantStatus(k.id)}
                            className={`px-2 py-1 text-xs font-medium rounded-lg ${
                              k.status === 'goedgekeurd'
                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                : 'bg-green-50 text-green-600 hover:bg-green-100'
                            }`}
                          >
                            {k.status === 'goedgekeurd' ? 'Deactiveer' : 'Activeer'}
                          </button>
                          <button
                            onClick={() => openKlantProfiel(k.id)}
                            className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                          >
                            Profiel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── AANVRAGEN ─── */}
        {activeTab === 'aanvragen' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Aanvragen</h2>
            <div className="flex gap-2 mb-4">
              {(['definitief', 'concepten'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setAanvraagSubTab(st)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
                    ${aanvraagSubTab === st ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {st === 'definitief' ? 'Definitief' : 'Concepten'}
                </button>
              ))}
            </div>

            {aanvraagSubTab === 'definitief' && (
              aanvragen.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-3xl mb-2">📬</p>
                  <p className="text-sm">Nog geen verstuurde aanvragen.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Project</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Klant</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Bedrijf</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600">Waarde</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Verstuurd</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-600">Bericht</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Fineerkeuze</th>
                        <th className="py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {aanvragen.map(a => (
                        <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-3 font-medium text-gray-800">{a.project}</td>
                          <td className="py-3 px-3 text-gray-600">{a.klant}</td>
                          <td className="py-3 px-3 text-gray-600">{a.bedrijf}</td>
                          <td className="py-3 px-3 text-right font-medium">€ {a.waarde.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 px-3 text-gray-400 text-xs">{a.verstuurd}</td>
                          <td className="py-3 px-3 text-center" title={a.bericht ?? ''}>{a.bericht ? '💬' : '—'}</td>
                          <td className="py-3 px-3 text-xs text-gray-500">{a.fineerkeuze ? `🪵 ${a.fineerkeuze}` : '—'}</td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => printAanvraag(a.id)}
                              title="Afdrukken / PDF"
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                              </svg>
                              Afdrukken
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {aanvraagSubTab === 'concepten' && (
              concepten.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-3xl mb-2">📋</p>
                  <p className="text-sm">Geen actieve concepten van klanten.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Orderlijst</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Klant</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Status</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Bijgewerkt</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Actie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {concepten.map(c => (
                        <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-3 font-medium text-gray-800">{c.naam}</td>
                          <td className="py-3 px-3 text-gray-600">{c.klant}</td>
                          <td className="py-3 px-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                              ${c.status === 'actueel' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-gray-400 text-xs">{c.bijgewerkt}</td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => openConceptModal(c.id, c.naam, c.klant)}
                              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                            >
                              Bekijk regels
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}

        {/* ─── PRIJZEN ─── */}
        {activeTab === 'prijzen' && (
          <div className="p-6 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Prijsbeheer</h2>
            </div>

            {/* Basisplaten */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Basisplaten</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => openAdd('baseplaat')}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    + Nieuw toevoegen
                  </button>
                  <button
                    onClick={() => exportPrijzenCsv('baseplaten')}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                  >
                    ↓ Exporteren
                  </button>
                  <button
                    onClick={() => triggerImport('baseplaten')}
                    className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 border border-green-200"
                  >
                    ↑ Importeren
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">Naam</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Dikte</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Breedte</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Lengte</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">€/m²</th>
                      <th className="text-center py-2 px-2 font-semibold text-gray-500">Actief</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {baseplaten.map(p => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">{p.naam}</td>
                        <td className="py-2 px-2 text-right text-gray-600">{p.dikte_mm}mm</td>
                        <td className="py-2 px-2 text-right text-gray-600">{p.breedte_mm}</td>
                        <td className="py-2 px-2 text-right text-gray-600">{p.lengte_mm}</td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            value={p.prijs_per_m2}
                            step="0.01"
                            onChange={e => setBaseplaten(b => b.map(x => x.id === p.id ? { ...x, prijs_per_m2: parseFloat(e.target.value) || 0 } : x))}
                            className="w-20 text-right px-1 py-0.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={p.beschikbaar}
                            onChange={() => setBaseplaten(b => b.map(x => x.id === p.id ? { ...x, beschikbaar: !x.beschikbaar } : x))}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEdit('baseplaat', p)}
                              className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                            >
                              Bewerken
                            </button>
                            <button
                              onClick={() => deleteBaseplaat(p.id)}
                              className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                            >
                              Verwijderen
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fineers */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Fineers</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => openAdd('fineer')}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    + Nieuw toevoegen
                  </button>
                  <button
                    onClick={() => exportPrijzenCsv('fineers')}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                  >
                    ↓ Exporteren
                  </button>
                  <button
                    onClick={() => triggerImport('fineers')}
                    className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 border border-green-200"
                  >
                    ↑ Importeren
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">Naam</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Voor lang</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Voor kort</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Tegen lang</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Tegen kort</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">FK Advies</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">Status lang</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">Status kort</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">Voegmethodes</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">Info</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fineers.map(f => (
                      <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">{f.naam}</td>
                        {[
                          { key: 'prijs_voorzijde_lang', val: f.prijs_voorzijde_lang },
                          { key: 'prijs_voorzijde_kort', val: f.prijs_voorzijde_kort },
                          { key: 'prijs_tegenzijde_lang', val: f.prijs_tegenzijde_lang },
                          { key: 'prijs_tegenzijde_kort', val: f.prijs_tegenzijde_kort },
                        ].map(field => (
                          <td key={field.key} className="py-2 px-2 text-right">
                            <input
                              type="number"
                              value={field.val}
                              step="0.01"
                              onChange={e => setFineers(arr => arr.map(x => x.id === f.id ? { ...x, [field.key]: parseFloat(e.target.value) || 0 } : x))}
                              className="w-20 text-right px-1 py-0.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                        ))}
                        <td className="py-2 px-2">
                          <select
                            value={f.fk_advies}
                            onChange={e => setFineers(arr => arr.map(x => x.id === f.id ? { ...x, fk_advies: e.target.value as Fineer['fk_advies'] } : x))}
                            className="text-xs px-1 py-0.5 border border-gray-300 rounded bg-white focus:outline-none"
                          >
                            <option value="fabriek">Fabriek</option>
                            <option value="foto_kuiper">Foto Kuiper</option>
                            <option value="foto_klant">Foto klant</option>
                            <option value="persoonlijk">Persoonlijk</option>
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant={f.status_lang === 'beschikbaar' ? 'active' : f.status_lang === 'tijdelijk_niet' ? 'warning' : 'inactive'}>
                            {f.status_lang}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant={f.status_kort === 'beschikbaar' ? 'active' : f.status_kort === 'tijdelijk_niet' ? 'warning' : 'inactive'}>
                            {f.status_kort}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1">
                            {f.voegmethodes.map(v => (
                              <span key={v} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{v}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-500 max-w-32 truncate" title={f.info}>
                          {f.info ? (f.info.length > 40 ? f.info.slice(0, 40) + '…' : f.info) : '—'}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEdit('fineer', f)}
                              className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                            >
                              Bewerken
                            </button>
                            <button
                              onClick={() => deleteFineer(f.id)}
                              className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                            >
                              Verwijderen
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* HPL */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">HPL</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => openAdd('hpl')}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    + Nieuw toevoegen
                  </button>
                  <button
                    onClick={() => exportPrijzenCsv('hpl')}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                  >
                    ↓ Exporteren
                  </button>
                  <button
                    onClick={() => triggerImport('hpl')}
                    className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 border border-green-200"
                  >
                    ↑ Importeren
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">Kleur</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">€ lang</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">€ kort</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Plaat B lang</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Plaat L lang</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">Status lang</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {hplList.map(h => (
                      <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">{h.kleur}</td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            value={h.prijs_lang}
                            step="0.01"
                            onChange={e => setHplList(arr => arr.map(x => x.id === h.id ? { ...x, prijs_lang: parseFloat(e.target.value) || 0 } : x))}
                            className="w-20 text-right px-1 py-0.5 border border-gray-300 rounded text-sm focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            value={h.prijs_kort}
                            step="0.01"
                            onChange={e => setHplList(arr => arr.map(x => x.id === h.id ? { ...x, prijs_kort: parseFloat(e.target.value) || 0 } : x))}
                            className="w-20 text-right px-1 py-0.5 border border-gray-300 rounded text-sm focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-2 text-right text-gray-500 text-xs">{h.hpl_afm_lang_b}mm</td>
                        <td className="py-2 px-2 text-right text-gray-500 text-xs">{h.hpl_afm_lang_l}mm</td>
                        <td className="py-2 px-2">
                          <Badge variant={h.status_lang === 'beschikbaar' ? 'active' : h.status_lang === 'tijdelijk_niet' ? 'warning' : 'inactive'}>
                            {h.status_lang}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEdit('hpl', h)}
                              className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                            >
                              Bewerken
                            </button>
                            <button
                              onClick={() => deleteHpl(h.id)}
                              className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                            >
                              Verwijderen
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={savePrijzen}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700"
            >
              Prijzen opslaan
            </button>
          </div>
        )}

        {/* ─── STAFFEL ─── */}
        {activeTab === 'staffel' && (
          <div className="p-6 space-y-8">
            <h2 className="text-lg font-semibold text-gray-800">Staffel & verzendkosten</h2>

            {/* Fineer & HPL staffel */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Staffel Fineer & HPL</h3>
                <button onClick={() => addStaffelRow('fh')} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  + Rij toevoegen
                </button>
              </div>
              <StaffelTable
                staffel={staffelFH}
                onChange={setStaffelFH}
                onRemove={id => removeStaffelRow('fh', id)}
              />
            </div>

            {/* Kaal staffel */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Staffel Kaal</h3>
                <button onClick={() => addStaffelRow('kaal')} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  + Rij toevoegen
                </button>
              </div>
              <StaffelTable
                staffel={staffelKaal}
                onChange={setStaffelKaal}
                onRemove={id => removeStaffelRow('kaal', id)}
              />
            </div>

            {/* Verzendkosten */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Verzendkosten</h3>
              <div className="grid sm:grid-cols-2 gap-4 max-w-sm">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Gratis boven (€)</label>
                  <input
                    type="number"
                    value={verzendDrempel}
                    onChange={e => setVerzendDrempel(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Kosten onder drempel (€)</label>
                  <input
                    type="number"
                    value={verzendKosten}
                    onChange={e => setVerzendKosten(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Preview: Bestelling van € {(verzendDrempel - 1).toFixed(0)} → € {verzendKosten.toFixed(2)} verzendkosten
                &nbsp;|&nbsp; Bestelling van € {verzendDrempel.toFixed(0)} → Gratis verzending
              </p>
            </div>

            {/* Vaste inkoopkosten */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Vaste inkoopkosten (€/m²)</h3>
              <p className="text-xs text-gray-400 mb-4">Deze kosten worden opgeteld bij de inkoopprijs voor de marge-berekening.</p>
              <div className="grid sm:grid-cols-2 gap-4 max-w-lg">
                {[
                  { label: 'Fineerlijm', val: fineerlijm, set: setFineerlijm, key: 'fineer' },
                  { label: 'Schuurbanden', val: schuurbanden, set: setSchuurbanden, key: 'schuur' },
                  { label: 'HPL lijm', val: hplLijm, set: setHplLijm, key: 'hpllm' },
                  { label: 'PU hotmelt lijm', val: puHotmelt, set: setPuHotmelt, key: 'pu' },
                ].map(({ label, val, set, key }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{label} (€/m²)</label>
                    <input
                      type="number"
                      value={val}
                      step="0.01"
                      min="0"
                      onChange={e => set(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={saveVasteKosten}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700"
              >
                Vaste kosten opslaan
              </button>
            </div>

            {/* PU Hotmelt combinaties */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">PU Hotmelt combinaties</h3>
              <p className="text-xs text-gray-400 mb-3">Basisplaat + categorie die PU hotmelt lijm gebruiken (i.p.v. fineerlijm / HPL lijm)</p>
              <div className="flex gap-2 mb-4 flex-wrap">
                <select
                  value={hmForm.basisplaat_id}
                  onChange={e => setHmForm(f => ({ ...f, basisplaat_id: e.target.value }))}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none"
                >
                  <option value="">— Kies basisplaat —</option>
                  {baseplaten.map(b => <option key={b.id} value={b.id}>{b.naam} {b.dikte_mm}mm</option>)}
                </select>
                <select
                  value={hmForm.categorie}
                  onChange={e => setHmForm(f => ({ ...f, categorie: e.target.value as 'fineer' | 'hpl' }))}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none"
                >
                  <option value="fineer">Fineer</option>
                  <option value="hpl">HPL</option>
                </select>
                <button
                  onClick={() => {
                    if (!hmForm.basisplaat_id) { toast.error('Kies een basisplaat'); return }
                    saveHotmeltComb(hmForm.basisplaat_id, hmForm.categorie)
                    setHmForm({ basisplaat_id: '', categorie: 'fineer' })
                  }}
                  className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  + Toevoegen
                </button>
              </div>
              {hotmeltCombs.length === 0 ? (
                <p className="text-sm text-gray-400">Geen hotmelt combinaties gedefinieerd.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">Basisplaat</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">Categorie</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotmeltCombs.map(hc => (
                      <tr key={hc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2">{baseplaten.find(x => x.id === hc.basisplaat_id)?.naam ?? hc.basisplaat_id}</td>
                        <td className="py-2 px-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${hc.categorie === 'hpl' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                            {hc.categorie}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <button
                            onClick={() => deleteHotmeltComb(hc.id)}
                            className="px-2 py-0.5 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                          >
                            Verwijderen
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <button
              onClick={saveStaffel}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700"
            >
              Opslaan
            </button>
          </div>
        )}

        {/* ─── GALERIJEN ─── */}
        {(activeTab === 'galerij_basisplaat' || activeTab === 'galerij_fineer' || activeTab === 'galerij_hpl') && (
          <GallerijTab
            title={
              activeTab === 'galerij_basisplaat' ? 'Galerij Basisplaat' :
              activeTab === 'galerij_fineer' ? 'Galerij Fineer' : 'Galerij HPL'
            }
            items={
              activeTab === 'galerij_basisplaat'
                ? baseplaten.map(p => ({ id: p.id, naam: p.naam, url: (p as Baseplaat & { gallery_foto_url?: string }).gallery_foto_url }))
                : activeTab === 'galerij_fineer'
                  ? fineers.map(f => ({ id: f.id, naam: f.naam, url: f.gallery_foto_url }))
                  : hplList.map(h => ({ id: h.id, naam: h.kleur, url: h.gallery_foto_url }))
            }
            tableName={
              activeTab === 'galerij_basisplaat' ? 'baseplaten' :
              activeTab === 'galerij_fineer' ? 'fineers' : 'hpl'
            }
            onUrlChange={(id, url) => {
              if (activeTab === 'galerij_basisplaat') {
                setBaseplaten(arr => arr.map(x => x.id === id ? { ...x, gallery_foto_url: url } as Baseplaat & { gallery_foto_url?: string } : x))
              } else if (activeTab === 'galerij_fineer') {
                setFineers(arr => arr.map(x => x.id === id ? { ...x, gallery_foto_url: url } : x))
              } else {
                setHplList(arr => arr.map(x => x.id === id ? { ...x, gallery_foto_url: url } : x))
              }
            }}
          />
        )}

        {/* ─── CRUD MODALS ─── */}
        {modalType !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) setModalType(null) }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">

              {/* ── Baseplaat modal ── */}
              {modalType === 'baseplaat' && (
                <>
                  <h3 className="text-base font-semibold text-gray-800 mb-4">{modalItem ? 'Basisplaat bewerken' : 'Nieuwe basisplaat'}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Naam *</label>
                      <input type="text" value={bpForm.naam} onChange={e => setBpForm(f => ({ ...f, naam: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Dikte (mm)</label>
                        <input type="number" value={bpForm.dikte_mm} onChange={e => setBpForm(f => ({ ...f, dikte_mm: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Breedte (mm)</label>
                        <input type="number" value={bpForm.breedte_mm} onChange={e => setBpForm(f => ({ ...f, breedte_mm: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Lengte (mm)</label>
                        <input type="number" value={bpForm.lengte_mm} onChange={e => setBpForm(f => ({ ...f, lengte_mm: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Prijs per m² (€)</label>
                        <input type="number" step="0.01" value={bpForm.prijs_per_m2} onChange={e => setBpForm(f => ({ ...f, prijs_per_m2: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Volgorde</label>
                        <input type="number" value={bpForm.volgorde ?? 0} onChange={e => setBpForm(f => ({ ...f, volgorde: parseInt(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Foto URL (optioneel)</label>
                      <input type="text" value={bpForm.gallery_foto_url ?? ''} onChange={e => setBpForm(f => ({ ...f, gallery_foto_url: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      {bpForm.gallery_foto_url && (
                        <img src={bpForm.gallery_foto_url} alt="" className="mt-2 h-16 w-24 object-cover rounded border border-gray-200" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="bp-beschikbaar" checked={bpForm.beschikbaar} onChange={e => setBpForm(f => ({ ...f, beschikbaar: e.target.checked }))} className="w-4 h-4" />
                      <label htmlFor="bp-beschikbaar" className="text-sm text-gray-700">Beschikbaar</label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-5">
                    <button onClick={() => setModalType(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Annuleren</button>
                    <button onClick={saveBaseplaat} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">Opslaan</button>
                  </div>
                </>
              )}

              {/* ── Fineer modal ── */}
              {modalType === 'fineer' && (
                <>
                  <h3 className="text-base font-semibold text-gray-800 mb-4">{modalItem ? 'Fineer bewerken' : 'Nieuw fineer'}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Naam *</label>
                      <input type="text" value={fnForm.naam} onChange={e => setFnForm(f => ({ ...f, naam: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Prijs voorzijde lang (€)</label>
                        <input type="number" step="0.01" value={fnForm.prijs_voorzijde_lang} onChange={e => setFnForm(f => ({ ...f, prijs_voorzijde_lang: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Prijs voorzijde kort (€)</label>
                        <input type="number" step="0.01" value={fnForm.prijs_voorzijde_kort} onChange={e => setFnForm(f => ({ ...f, prijs_voorzijde_kort: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Prijs tegenzijde lang (€)</label>
                        <input type="number" step="0.01" value={fnForm.prijs_tegenzijde_lang} onChange={e => setFnForm(f => ({ ...f, prijs_tegenzijde_lang: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Prijs tegenzijde kort (€)</label>
                        <input type="number" step="0.01" value={fnForm.prijs_tegenzijde_kort} onChange={e => setFnForm(f => ({ ...f, prijs_tegenzijde_kort: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Voegmethodes</label>
                      <div className="flex flex-wrap gap-2">
                        {VOEGMETHODE_OPTIONS.map(v => (
                          <label key={v} className="flex items-center gap-1 text-sm">
                            <input type="checkbox" checked={fnForm.voegmethodes.includes(v)}
                              onChange={e => {
                                const next = e.target.checked
                                  ? [...fnForm.voegmethodes, v]
                                  : fnForm.voegmethodes.filter(x => x !== v)
                                const std = next.includes(fnForm.voeg_standaard) ? fnForm.voeg_standaard : (next[0] ?? '')
                                setFnForm(f => ({ ...f, voegmethodes: next, voeg_standaard: std }))
                              }} className="w-3.5 h-3.5" />
                            {v}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Voeg standaard</label>
                      {fnForm.voegmethodes.length > 0 ? (
                        <select value={fnForm.voeg_standaard} onChange={e => setFnForm(f => ({ ...f, voeg_standaard: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          {fnForm.voegmethodes.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={fnForm.voeg_standaard} onChange={e => setFnForm(f => ({ ...f, voeg_standaard: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">FK Advies</label>
                        <select value={fnForm.fk_advies} onChange={e => setFnForm(f => ({ ...f, fk_advies: e.target.value as Fineer['fk_advies'] }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="fabriek">Fabriek</option>
                          <option value="foto_kuiper">Foto Kuiper</option>
                          <option value="foto_klant">Foto klant</option>
                          <option value="persoonlijk">Persoonlijk</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Status lang</label>
                        <select value={fnForm.status_lang} onChange={e => setFnForm(f => ({ ...f, status_lang: e.target.value as Fineer['status_lang'] }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="beschikbaar">Beschikbaar</option>
                          <option value="tijdelijk_niet">Tijdelijk niet</option>
                          <option value="niet_beschikbaar">Niet beschikbaar</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Status kort</label>
                        <select value={fnForm.status_kort} onChange={e => setFnForm(f => ({ ...f, status_kort: e.target.value as Fineer['status_kort'] }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="beschikbaar">Beschikbaar</option>
                          <option value="tijdelijk_niet">Tijdelijk niet</option>
                          <option value="niet_beschikbaar">Niet beschikbaar</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Info (voor klant)</label>
                      <textarea value={fnForm.info ?? ''} onChange={e => setFnForm(f => ({ ...f, info: e.target.value }))} rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Foto URL (optioneel)</label>
                      <input type="text" value={fnForm.gallery_foto_url ?? ''} onChange={e => setFnForm(f => ({ ...f, gallery_foto_url: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      {fnForm.gallery_foto_url && (
                        <img src={fnForm.gallery_foto_url} alt="" className="mt-2 h-16 w-24 object-cover rounded border border-gray-200" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Volgorde</label>
                      <input type="number" value={fnForm.volgorde ?? 0} onChange={e => setFnForm(f => ({ ...f, volgorde: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-5">
                    <button onClick={() => setModalType(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Annuleren</button>
                    <button onClick={saveFineer} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">Opslaan</button>
                  </div>
                </>
              )}

              {/* ── HPL modal ── */}
              {modalType === 'hpl' && (
                <>
                  <h3 className="text-base font-semibold text-gray-800 mb-4">{modalItem ? 'HPL bewerken' : 'Nieuw HPL'}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Kleur *</label>
                      <input type="text" value={hplForm.kleur} onChange={e => setHplForm(f => ({ ...f, kleur: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Prijs lang (€)</label>
                        <input type="number" step="0.01" value={hplForm.prijs_lang} onChange={e => setHplForm(f => ({ ...f, prijs_lang: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Prijs kort (€)</label>
                        <input type="number" step="0.01" value={hplForm.prijs_kort} onChange={e => setHplForm(f => ({ ...f, prijs_kort: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Afm. lang breedte (mm)</label>
                        <input type="number" value={hplForm.hpl_afm_lang_b} onChange={e => setHplForm(f => ({ ...f, hpl_afm_lang_b: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Afm. lang lengte (mm)</label>
                        <input type="number" value={hplForm.hpl_afm_lang_l} onChange={e => setHplForm(f => ({ ...f, hpl_afm_lang_l: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Afm. kort breedte (mm)</label>
                        <input type="number" value={hplForm.hpl_afm_kort_b} onChange={e => setHplForm(f => ({ ...f, hpl_afm_kort_b: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Afm. kort lengte (mm)</label>
                        <input type="number" value={hplForm.hpl_afm_kort_l} onChange={e => setHplForm(f => ({ ...f, hpl_afm_kort_l: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Status lang</label>
                        <select value={hplForm.status_lang} onChange={e => setHplForm(f => ({ ...f, status_lang: e.target.value as HPL['status_lang'] }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="beschikbaar">Beschikbaar</option>
                          <option value="tijdelijk_niet">Tijdelijk niet</option>
                          <option value="niet_beschikbaar">Niet beschikbaar</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Status kort</label>
                        <select value={hplForm.status_kort} onChange={e => setHplForm(f => ({ ...f, status_kort: e.target.value as HPL['status_kort'] }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="beschikbaar">Beschikbaar</option>
                          <option value="tijdelijk_niet">Tijdelijk niet</option>
                          <option value="niet_beschikbaar">Niet beschikbaar</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Info (voor klant)</label>
                      <textarea value={hplForm.info ?? ''} onChange={e => setHplForm(f => ({ ...f, info: e.target.value }))} rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Foto URL (optioneel)</label>
                      <input type="text" value={hplForm.gallery_foto_url ?? ''} onChange={e => setHplForm(f => ({ ...f, gallery_foto_url: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      {hplForm.gallery_foto_url && (
                        <img src={hplForm.gallery_foto_url} alt="" className="mt-2 h-16 w-24 object-cover rounded border border-gray-200" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Volgorde</label>
                      <input type="number" value={hplForm.volgorde ?? 0} onChange={e => setHplForm(f => ({ ...f, volgorde: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-5">
                    <button onClick={() => setModalType(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Annuleren</button>
                    <button onClick={saveHpl} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">Opslaan</button>
                  </div>
                </>
              )}

            </div>
          </div>
        )}

        {/* ─── BEWERKINGEN ─── */}
        {activeTab === 'bewerkingen' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Bewerkingen beheren</h2>
              <button
                onClick={openBwAdd}
                className="text-sm px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
              >
                + Nieuw toevoegen
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-500">Naam</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-500">Beschrijving</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500">€/m²</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-500">Compatibiliteit</th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-500">Status</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {bewerkingen.map(b => (
                    <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium">
                        {b.naam}
                        {b.standaard_geselecteerd && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">standaard</span>}
                      </td>
                      <td className="py-3 px-3 text-gray-500 text-xs max-w-48">{b.beschrijving || '—'}</td>
                      <td className="py-3 px-3 text-right">€ {b.prijs.toFixed(2)}</td>
                      <td className="py-3 px-3">
                        <div className="flex gap-1 flex-wrap">
                          {b.compatibiliteit.map(c => (
                            <Badge key={c} variant="info">{c}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => toggleBewerking(b.id)}
                          className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                            b.beschikbaar
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {b.beschikbaar ? '✓ Actief' : '✗ Inactief'}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openBwEdit(b)} className="text-xs px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded-lg font-medium">Bewerken</button>
                          <button onClick={() => deleteBw(b)} className="text-xs px-2.5 py-1 text-red-500 hover:bg-red-50 rounded-lg font-medium">Verwijderen</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Uitsluiting modal — moved to uitsluitingen tab */}
            {false && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setUitModal(m => ({ ...m, open: false }))}>
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
                  <h3 className="text-base font-semibold text-gray-800">Uitsluiting toevoegen</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Subject type</label>
                      <select
                        value={uitModal.form.subject_type}
                        onChange={e => setUitModal(m => ({ ...m, form: { ...m.form, subject_type: e.target.value, subject_id: '' } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="basisplaat">Basisplaat</option>
                        <option value="fineer">Fineer</option>
                        <option value="hpl">HPL</option>
                        <option value="bewerking">Bewerking</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Subject item</label>
                      <select
                        value={uitModal.form.subject_id}
                        onChange={e => setUitModal(m => ({ ...m, form: { ...m.form, subject_id: e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">— Kies item —</option>
                        {getItemsForType(uitModal.form.subject_type).map(x => (
                          <option key={x.id} value={x.id}>{x.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Uitgesloten type</label>
                      <select
                        value={uitModal.form.uitgesloten_type}
                        onChange={e => setUitModal(m => ({ ...m, form: { ...m.form, uitgesloten_type: e.target.value, uitgesloten_id: '' } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="basisplaat">Basisplaat</option>
                        <option value="fineer">Fineer</option>
                        <option value="hpl">HPL</option>
                        <option value="bewerking">Bewerking</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Uitgesloten item</label>
                      <select
                        value={uitModal.form.uitgesloten_id}
                        onChange={e => setUitModal(m => ({ ...m, form: { ...m.form, uitgesloten_id: e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">— Kies item —</option>
                        {getItemsForType(uitModal.form.uitgesloten_type).map(x => (
                          <option key={x.id} value={x.id}>{x.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Reden (optioneel)</label>
                    <input
                      type="text"
                      value={uitModal.form.reden}
                      onChange={e => setUitModal(m => ({ ...m, form: { ...m.form, reden: e.target.value } }))}
                      placeholder="Bijv. technisch niet compatibel"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setUitModal(m => ({ ...m, open: false }))} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuleren</button>
                    <button onClick={saveUitsluiting} className="px-5 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Opslaan</button>
                  </div>
                </div>
              </div>
            )}

            {/* Bewerking modal */}
            {bwModal.open && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setBwModal(m => ({ ...m, open: false }))}>
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                  <h3 className="text-base font-semibold text-gray-800">{bwModal.item ? 'Bewerking bewerken' : 'Bewerking toevoegen'}</h3>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Naam *</label>
                    <input type="text" value={bwModal.form.naam} onChange={e => setBwModal(m => ({ ...m, form: { ...m.form, naam: e.target.value } }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Beschrijving</label>
                    <input type="text" value={bwModal.form.beschrijving} onChange={e => setBwModal(m => ({ ...m, form: { ...m.form, beschrijving: e.target.value } }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Prijstype</label>
                    <select value={bwModal.form.prijs_type} onChange={e => setBwModal(m => ({ ...m, form: { ...m.form, prijs_type: e.target.value as 'per_m2' | 'per_order' } }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="per_m2">Per m² (× oppervlak × aantal)</option>
                      <option value="per_order">Vast per order (eenmalig vast bedrag)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Prijs {bwModal.form.prijs_type === 'per_order' ? '(€ vast per order)' : '(€/m²)'}
                      </label>
                      <input type="number" step="0.01" value={bwModal.form.prijs} onChange={e => setBwModal(m => ({ ...m, form: { ...m.form, prijs: parseFloat(e.target.value) || 0 } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Volgorde</label>
                      <input type="number" value={bwModal.form.volgorde} onChange={e => setBwModal(m => ({ ...m, form: { ...m.form, volgorde: parseInt(e.target.value) || 0 } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Compatibiliteit</label>
                    <div className="flex gap-4">
                      {(['kaal', 'fineer', 'hpl'] as const).map(c => (
                        <label key={c} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <input type="checkbox" checked={bwModal.form.compatibiliteit.includes(c)}
                            onChange={e => setBwModal(m => ({ ...m, form: { ...m.form, compatibiliteit: e.target.checked ? [...m.form.compatibiliteit, c] : m.form.compatibiliteit.filter(x => x !== c) } }))}
                            className="w-4 h-4 rounded" />
                          {c}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="bw-beschikbaar" checked={bwModal.form.beschikbaar} onChange={e => setBwModal(m => ({ ...m, form: { ...m.form, beschikbaar: e.target.checked } }))} className="w-4 h-4" />
                    <label htmlFor="bw-beschikbaar" className="text-sm text-gray-700">Beschikbaar in configurator</label>
                  </div>

                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    <input type="checkbox" id="bw-standaard" checked={bwModal.form.standaard_geselecteerd} onChange={e => setBwModal(m => ({ ...m, form: { ...m.form, standaard_geselecteerd: e.target.checked } }))} className="w-4 h-4 accent-amber-500" />
                    <label htmlFor="bw-standaard" className="text-sm text-amber-800 font-medium">Standaard voorgeselecteerd <span className="font-normal text-amber-600">(klant moet zelf deselecteren)</span></label>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setBwModal(m => ({ ...m, open: false }))} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuleren</button>
                    <button onClick={saveBw} className="px-5 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Opslaan</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── INSLUITINGEN ─── */}
        {activeTab === 'insluitingen' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Insluitingen / Verplichte combinaties</h2>
                <p className="text-sm text-gray-500 mt-0.5">Als een onderdeel insluitingen heeft, worden in de configurator <strong>alleen</strong> die items getoond voor dat type.</p>
              </div>
              <button
                onClick={() => setInsModal({ open: true, form: emptyInsForm })}
                className="text-sm px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
              >
                + Toevoegen
              </button>
            </div>

            {insluitingen.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">🔒</p>
                <p className="text-sm">Geen insluitingen ingesteld.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-500">Als subject</th>
                      <th className="py-2 px-2"></th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500">Alleen met</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500">Reden</th>
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {insluitingen.map(u => (
                      <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-3">
                          <span className="text-xs text-gray-400 capitalize">{u.subject_type}:</span>{' '}
                          <span className="font-medium text-gray-800">{resolveNaam(u.subject_type, u.subject_id)}</span>
                        </td>
                        <td className="py-3 px-2 text-green-500 font-bold">→</td>
                        <td className="py-3 px-3">
                          <span className="text-xs text-gray-400 capitalize">{u.ingesloten_type}:</span>{' '}
                          <span className="font-medium text-gray-800">{resolveNaam(u.ingesloten_type, u.ingesloten_id)}</span>
                        </td>
                        <td className="py-3 px-3 text-gray-500 text-xs">{u.reden ?? '—'}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => deleteInsluiting(u.id)}
                            className="text-xs px-2.5 py-1 text-red-500 hover:bg-red-50 rounded-lg font-medium"
                          >
                            Verwijderen
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Insluiting modal */}
            {insModal.open && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setInsModal(m => ({ ...m, open: false }))}>
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
                  <h3 className="text-base font-semibold text-gray-800">Insluiting toevoegen</h3>
                  <p className="text-xs text-gray-500">Als het gekozen subject is geselecteerd in de configurator, worden voor het gekozen type <strong>alleen</strong> de ingesloten items getoond.</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Subject type</label>
                      <select value={insModal.form.subject_type} onChange={e => setInsModal(m => ({ ...m, form: { ...m.form, subject_type: e.target.value, subject_id: '' } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                        <option value="basisplaat">Basisplaat</option>
                        <option value="fineer">Fineer</option>
                        <option value="hpl">HPL</option>
                        <option value="bewerking">Bewerking</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Subject item</label>
                      <select value={insModal.form.subject_id} onChange={e => setInsModal(m => ({ ...m, form: { ...m.form, subject_id: e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                        <option value="">— Kies item —</option>
                        {getItemsForType(insModal.form.subject_type).map(x => (
                          <option key={x.id} value={x.id}>{x.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Toegestaan type</label>
                      <select value={insModal.form.ingesloten_type} onChange={e => setInsModal(m => ({ ...m, form: { ...m.form, ingesloten_type: e.target.value, ingesloten_id: '' } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                        <option value="basisplaat">Basisplaat</option>
                        <option value="fineer">Fineer</option>
                        <option value="hpl">HPL</option>
                        <option value="bewerking">Bewerking</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Toegestaan item</label>
                      <select value={insModal.form.ingesloten_id} onChange={e => setInsModal(m => ({ ...m, form: { ...m.form, ingesloten_id: e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                        <option value="">— Kies item —</option>
                        {getItemsForType(insModal.form.ingesloten_type).map(x => (
                          <option key={x.id} value={x.id}>{x.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Reden (optioneel)</label>
                    <input type="text" value={insModal.form.reden} onChange={e => setInsModal(m => ({ ...m, form: { ...m.form, reden: e.target.value } }))}
                      placeholder="Bijv. alleen compatibel met deze afwerking"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setInsModal(m => ({ ...m, open: false }))} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuleren</button>
                    <button onClick={saveInsluiting} className="px-5 py-2 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Opslaan</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── UITSLUITINGEN ─── */}
        {activeTab === 'uitsluitingen' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Uitsluitingen / Incompatibiliteiten</h2>
              <button
                onClick={() => setUitModal({ open: true, form: emptyUitForm })}
                className="text-sm px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
              >
                + Toevoegen
              </button>
            </div>

            {uitsluitingen.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">🔗</p>
                <p className="text-sm">Geen uitsluitingen ingesteld.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-500">Subject</th>
                      <th className="py-2 px-2"></th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500">Uitgesloten</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500">Reden</th>
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {uitsluitingen.map(u => (
                      <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-3">
                          <span className="text-xs text-gray-400 capitalize">{u.subject_type}:</span>{' '}
                          <span className="font-medium text-gray-800">{resolveNaam(u.subject_type, u.subject_id)}</span>
                        </td>
                        <td className="py-3 px-2 text-gray-400">→</td>
                        <td className="py-3 px-3">
                          <span className="text-xs text-gray-400 capitalize">{u.uitgesloten_type}:</span>{' '}
                          <span className="font-medium text-gray-800">{resolveNaam(u.uitgesloten_type, u.uitgesloten_id)}</span>
                        </td>
                        <td className="py-3 px-3 text-gray-500 text-xs">{u.reden ?? '—'}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => deleteUitsluiting(u.id)}
                            className="text-xs px-2.5 py-1 text-red-500 hover:bg-red-50 rounded-lg font-medium"
                          >
                            Verwijderen
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Uitsluiting modal */}
            {uitModal.open && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setUitModal(m => ({ ...m, open: false }))}>
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
                  <h3 className="text-base font-semibold text-gray-800">Uitsluiting toevoegen</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Subject type</label>
                      <select value={uitModal.form.subject_type} onChange={e => setUitModal(m => ({ ...m, form: { ...m.form, subject_type: e.target.value, subject_id: '' } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="basisplaat">Basisplaat</option>
                        <option value="fineer">Fineer</option>
                        <option value="hpl">HPL</option>
                        <option value="bewerking">Bewerking</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Subject item</label>
                      <select value={uitModal.form.subject_id} onChange={e => setUitModal(m => ({ ...m, form: { ...m.form, subject_id: e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">— Kies item —</option>
                        {getItemsForType(uitModal.form.subject_type).map(x => (
                          <option key={x.id} value={x.id}>{x.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Uitgesloten type</label>
                      <select value={uitModal.form.uitgesloten_type} onChange={e => setUitModal(m => ({ ...m, form: { ...m.form, uitgesloten_type: e.target.value, uitgesloten_id: '' } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="basisplaat">Basisplaat</option>
                        <option value="fineer">Fineer</option>
                        <option value="hpl">HPL</option>
                        <option value="bewerking">Bewerking</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Uitgesloten item</label>
                      <select value={uitModal.form.uitgesloten_id} onChange={e => setUitModal(m => ({ ...m, form: { ...m.form, uitgesloten_id: e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">— Kies item —</option>
                        {getItemsForType(uitModal.form.uitgesloten_type).map(x => (
                          <option key={x.id} value={x.id}>{x.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Reden (optioneel)</label>
                    <input type="text" value={uitModal.form.reden} onChange={e => setUitModal(m => ({ ...m, form: { ...m.form, reden: e.target.value } }))}
                      placeholder="Bijv. technisch niet compatibel"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setUitModal(m => ({ ...m, open: false }))} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuleren</button>
                    <button onClick={saveUitsluiting} className="px-5 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Opslaan</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Klant-profiel modal */}
    {klantProfiel.open && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setKlantProfiel(v => ({ ...v, open: false }))}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-800">Klantprofiel</h2>
            <button onClick={() => setKlantProfiel(v => ({ ...v, open: false }))} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {klantProfiel.loading ? (
              <p className="text-sm text-gray-400 text-center py-8">Laden…</p>
            ) : !klantProfiel.data ? (
              <p className="text-sm text-gray-400 text-center py-8">Profiel niet beschikbaar (demo modus).</p>
            ) : (
              <div className="space-y-5">
                {/* Persoonlijk */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Persoonlijk</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Naam', value: klantProfiel.data.naam },
                      { label: 'E-mail', value: klantProfiel.data.email },
                      { label: 'Telefoon', value: klantProfiel.data.telefoon ?? '—' },
                      { label: 'Bevestigingsmail', value: klantProfiel.data.order_confirm_email ?? '—' },
                      { label: 'CC', value: klantProfiel.data.order_confirm_email_cc || '—' },
                    ].map(f => (
                      <div key={f.label} className="flex justify-between text-sm">
                        <span className="text-gray-500 w-36 shrink-0">{f.label}</span>
                        <span className="text-gray-800 font-medium text-right break-all">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bedrijf */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Bedrijf</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Bedrijfsnaam', value: klantProfiel.data.bedrijf },
                      { label: 'KvK', value: klantProfiel.data.kvk ?? '—' },
                      { label: 'Branche', value: klantProfiel.data.branche ?? '—' },
                      { label: 'Adres', value: klantProfiel.data.adres ?? '—' },
                    ].map(f => (
                      <div key={f.label} className="flex justify-between text-sm">
                        <span className="text-gray-500 w-36 shrink-0">{f.label}</span>
                        <span className="text-gray-800 font-medium text-right">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Account */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Account</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 w-36 shrink-0">Status</span>
                      <span className={`font-medium ${klantProfiel.data.status === 'goedgekeurd' ? 'text-green-600' : 'text-red-500'}`}>
                        {klantProfiel.data.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 w-36 shrink-0">Aangemaakt</span>
                      <span className="text-gray-800 font-medium">
                        {new Date(klantProfiel.data.aangemaakt_op).toLocaleDateString('nl-NL')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 w-36 shrink-0">Laatste sessie</span>
                      <span className="text-gray-800 font-medium">
                        {klantProfiel.data.last_seen_at
                          ? new Date(klantProfiel.data.last_seen_at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 w-36 shrink-0">Activiteit</span>
                      <span className="text-gray-800 font-medium">{klantProfiel.clicks} acties</span>
                    </div>
                  </div>
                </div>

                {/* Rol wijzigen */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Rol wijzigen</p>
                  <div className="flex items-center gap-3">
                    <select
                      value={klantProfiel.nieuwRol}
                      onChange={e => setKlantProfiel(v => ({ ...v, nieuwRol: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="kijker">Kijker — kan catalogus bekijken</option>
                      <option value="calculator">Calculator — kan prijzen berekenen</option>
                      <option value="inkoper">Inkoper — kan bestellingen plaatsen</option>
                      <option value="admin">Admin — volledige toegang</option>
                    </select>
                    <button
                      onClick={saveKlantRol}
                      disabled={klantProfiel.savingRol || klantProfiel.nieuwRol === klantProfiel.data.rol}
                      className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {klantProfiel.savingRol ? 'Opslaan…' : 'Opslaan'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Huidige rol: <strong>{klantProfiel.data.rol}</strong></p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Concept-regels modal */}
    {conceptModal.open && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setConceptModal(v => ({ ...v, open: false }))}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-base font-bold text-gray-800">{conceptModal.naam}</h2>
              <p className="text-xs text-gray-400 mt-0.5">Klant: {conceptModal.klant}</p>
            </div>
            <button onClick={() => setConceptModal(v => ({ ...v, open: false }))} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {conceptModal.loading ? (
              <p className="text-sm text-gray-400 text-center py-8">Laden…</p>
            ) : conceptModal.regels.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Geen regels in deze orderlijst.</p>
            ) : (
              <div className="space-y-2">
                {conceptModal.regels.map((r, i) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-gray-400 w-6">#{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{r.plaatNaam}</p>
                        <p className="text-xs text-gray-500">{r.afwerking}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium mr-2
                        ${r.categorie === 'fineer' ? 'bg-amber-100 text-amber-700' : r.categorie === 'hpl' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                        {r.categorie}
                      </span>
                      <span className="text-sm font-semibold text-gray-700">{r.aantal}×</span>
                      {r.totaal_prijs != null && (
                        <span className="text-xs text-gray-400 ml-2">€ {r.totaal_prijs.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {conceptModal.regels.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex justify-between items-center text-sm">
              <span className="text-gray-500">{conceptModal.regels.length} regel{conceptModal.regels.length !== 1 ? 's' : ''}</span>
              <span className="font-bold text-gray-800">
                Totaal: € {conceptModal.regels.reduce((s, r) => s + (r.totaal_prijs ?? 0), 0).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  )
}

function StaffelTable({
  staffel,
  onChange,
  onRemove,
}: {
  staffel: StaffelRegel[]
  onChange: (s: StaffelRegel[]) => void
  onRemove: (id: string) => void
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="text-left py-2 px-2 font-semibold text-gray-500">Van aantal</th>
          <th className="text-left py-2 px-2 font-semibold text-gray-500">Tot aantal</th>
          <th className="text-left py-2 px-2 font-semibold text-gray-500">Marge coëff.</th>
          <th className="text-left py-2 px-2 font-semibold text-gray-500">Bruto marge</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {staffel.map(r => (
          <tr key={r.id} className="border-b border-gray-100">
            <td className="py-1.5 px-2">
              <input
                type="number"
                value={r.van_aantal}
                onChange={e => onChange(staffel.map(x => x.id === r.id ? { ...x, van_aantal: parseInt(e.target.value) || 0 } : x))}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none"
              />
            </td>
            <td className="py-1.5 px-2">
              <input
                type="number"
                value={r.tot_aantal ?? ''}
                placeholder="∞"
                onChange={e => onChange(staffel.map(x => x.id === r.id ? { ...x, tot_aantal: e.target.value ? parseInt(e.target.value) : null } : x))}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none"
              />
            </td>
            <td className="py-1.5 px-2">
              <input
                type="number"
                value={r.marge_coefficient}
                step="0.01"
                min="0.01"
                max="1"
                onChange={e => onChange(staffel.map(x => x.id === r.id ? { ...x, marge_coefficient: parseFloat(e.target.value) || 0.65 } : x))}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none"
              />
            </td>
            <td className="py-1.5 px-2 text-sm">
              <Badge variant="info">
                {Math.round((1 - r.marge_coefficient) * 100)}%
              </Badge>
            </td>
            <td className="py-1.5 px-2">
              <button
                onClick={() => onRemove(r.id)}
                className="text-red-400 hover:text-red-600 text-xs px-2 py-0.5 hover:bg-red-50 rounded"
              >
                ✕
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function GallerijTab({
  title,
  items,
  tableName,
  onUrlChange,
}: {
  title: string
  items: { id: string; naam: string; url: string | undefined }[]
  tableName: string
  onUrlChange: (id: string, url: string) => void
}) {
  const [urlInputs, setUrlInputs] = useState<Record<string, string>>(
    Object.fromEntries(items.map(i => [i.id, i.url ?? '']))
  )

  async function saveUrl(id: string) {
    const url = urlInputs[id] ?? ''
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.from(tableName).update({ gallery_foto_url: url || null }).eq('id', id)
      if (error) { toast.error('Opslaan mislukt: ' + error.message); return }
      onUrlChange(id, url)
      toast.success('URL opgeslagen')
    } catch (e) {
      toast.error('Opslaan mislukt')
      console.error(e)
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">{title}</h2>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-4 border border-gray-200 rounded-xl p-3">
            <div className="w-20 h-16 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center border border-gray-100">
              {urlInputs[item.id] ? (
                <img
                  src={urlInputs[item.id]}
                  alt={item.naam}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <span className="text-2xl opacity-20">🪵</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 mb-1 truncate">{item.naam}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInputs[item.id] ?? ''}
                  onChange={e => setUrlInputs(u => ({ ...u, [item.id]: e.target.value }))}
                  placeholder="https://…"
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => saveUrl(item.id)}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
                >
                  Opslaan
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
