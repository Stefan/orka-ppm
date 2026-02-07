'use client'

import Link from 'next/link'

export default function DatenschutzPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-gray-700 dark:text-slate-300">
      <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-6 inline-block">
        ← Zurück zur App
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-6">Datenschutzerklärung</h1>
      <div className="prose dark:prose-invert max-w-none space-y-4">
        <p>
          Diese Datenschutzerklärung informiert Sie über die Verarbeitung personenbezogener Daten im Rahmen dieser PPM-Anwendung.
        </p>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mt-6">1. Verantwortlicher</h2>
        <p>
          Verantwortlich für die Datenverarbeitung ist der in unserem <Link href="/legal/impressum" className="underline">Impressum</Link> genannte Anbieter.
        </p>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mt-6">2. Erhobene Daten und Zweck</h2>
        <p>
          Wir verarbeiten Daten, die für die Bereitstellung des Dienstes erforderlich sind: Account-Daten (E-Mail, Anzeigename), Nutzungsdaten (Projekte, Ressourcen, Berichte) sowie technische Logdaten (IP, Zugriffszeiten) im erforderlichen Umfang. Die Rechtsgrundlage ist Vertragserfüllung bzw. berechtigtes Interesse (Betriebssicherheit).
        </p>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mt-6">3. Hosting und Datenverarbeitung</h2>
        <p>
          Die Anwendung kann auf Servern in der EU bzw. im EWR gehostet werden. Auftragsverarbeiter (z. B. Supabase, Hosting-Provider) werden vertraglich im Sinne von Art. 28 DSGVO gebunden. Eine Dokumentation der Verarbeitung (AV-Vertrag, Subprozessoren) wird auf Anfrage bereitgestellt.
        </p>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mt-6">4. Ihre Rechte</h2>
        <p>
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Beschwerden können Sie bei einer Aufsichtsbehörde geltend machen.
        </p>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-8">
          Stand: Platzhalter – bitte mit Datum und ggf. Anpassungen an Ihr Produkt versehen.
        </p>
      </div>
    </div>
  )
}
