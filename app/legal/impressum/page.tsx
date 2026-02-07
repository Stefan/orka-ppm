'use client'

import Link from 'next/link'

export default function ImpressumPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-gray-700 dark:text-slate-300">
      <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-6 inline-block">
        ← Zurück zur App
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-6">Impressum</h1>
      <div className="prose dark:prose-invert max-w-none space-y-4">
        <p>
          Angaben gemäß § 5 TMG (Platzhalter – bitte durch Ihre Unternehmensdaten ersetzen):
        </p>
        <p>
          <strong>Betreiber / Anbieter</strong><br />
          [Firmenname]<br />
          [Straße, Hausnummer]<br />
          [PLZ Ort]<br />
          [Land]
        </p>
        <p>
          <strong>Kontakt</strong><br />
          E-Mail: [Kontakt-E-Mail]<br />
          Telefon: [optional]
        </p>
        <p>
          <strong>Umsatzsteuer-ID</strong> (falls vorhanden): [USt-IdNr.]
        </p>
        <p>
          <strong>Verantwortlich für den Inhalt</strong> (§ 55 Abs. 2 RStV): [Name, Anschrift]
        </p>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-8">
          Hosting und technische Umsetzung: siehe <Link href="/legal/datenschutz" className="underline">Datenschutz</Link>.
        </p>
      </div>
    </div>
  )
}
