'use client'

import Link from 'next/link'

export default function AGBPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-gray-700 dark:text-slate-300">
      <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-6 inline-block">
        ← Zurück zur App
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-6">Allgemeine Geschäftsbedingungen (AGB)</h1>
      <div className="prose dark:prose-invert max-w-none space-y-4">
        <p>
          Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der PPM-SaaS-Anwendung (Projekt- und Portfoliomanagement).
        </p>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mt-6">1. Geltungsbereich</h2>
        <p>
          Die AGB gelten für alle Verträge zwischen dem Anbieter (siehe <Link href="/legal/impressum" className="underline">Impressum</Link>) und dem Kunden über die Nutzung der Software als Dienstleistung (SaaS).
        </p>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mt-6">2. Leistungsumfang</h2>
        <p>
          Der Anbieter stellt die Anwendung gemäß der vereinbarten Nutzungsart (z. B. nach Organisation/Tenant, Nutzeranzahl oder Modul) zur Verfügung. Änderungen des Leistungsumfangs werden separat vereinbart bzw. in der Produktdokumentation beschrieben.
        </p>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mt-6">3. Preise und Zahlung</h2>
        <p>
          Preise und Zahlungsbedingungen ergeben sich aus dem jeweiligen Vertrag bzw. der Bestellung. Bei Self-Serve-Modellen gelten die zum Zeitpunkt der Bestellung angezeigten Preise. Rechnungsstellung erfolgt gemäß Vereinbarung (monatlich/jährlich, manuell oder automatisiert).
        </p>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mt-6">4. Mitwirkung und Nutzung</h2>
        <p>
          Der Kunde stellt die für den Zugang erforderlichen Daten korrekt bereit und nutzt die Anwendung nur im Rahmen der vereinbarten Nutzungsrechte. Missbräuchliche oder rechtswidrige Nutzung ist untersagt.
        </p>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mt-6">5. Datenschutz</h2>
        <p>
          Die Verarbeitung personenbezogener Daten richtet sich nach der <Link href="/legal/datenschutz" className="underline">Datenschutzerklärung</Link> und den geltenden datenschutzrechtlichen Vereinbarungen (AV-Vertrag).
        </p>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-8">
          Stand: Platzhalter – bitte mit Datum und ggf. Anpassungen an Ihr Produkt versehen.
        </p>
      </div>
    </div>
  )
}
