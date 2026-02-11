# Zuordnung von Commitments und Actuals zu Projekten

## Wie die Zuordnung funktioniert

Commitments und Actuals werden **über die Projektnummer (project_nr)** den Projekten zugeordnet:

1. **In den CSV-Dateien** (Commitments/Actuals) gibt es die Spalte **project_nr** (bzw. gemappte Felder wie "Project", "Project Nr").
2. **Beim Import** sucht der Backend-Service für jede Zeile ein Projekt mit **`projects.name == project_nr`** (Datenbanktabelle `projects`, Feld `name`).
3. **Wird kein Projekt gefunden**, wird automatisch ein neues angelegt mit:
   - `name` = diese project_nr
   - `portfolio_id` = Standard-Portfolio
   - `status` = active, `health` = green

Damit werden Commitments/Actuals dem richtigen Projekt zugeordnet, sofern die project_nr in der CSV mit dem **Namen** des Projekts in der App übereinstimmt (oder ein Projekt mit diesem Namen beim Import angelegt wird).

## Empfohlener Ablauf bei Anonymisierung

Wenn **Anonymisierung** aktiv ist (Standard für Commitments/Actuals und optional für Projekte):

1. **Projektnummern** werden deterministisch ersetzt (gleiche Original-Nummer → immer dieselbe Ersatz-Nummer Pxxxx), damit die Verknüpfung erhalten bleibt.
2. **Projekte zuerst importieren** (CSV oder JSON): Projekt-`name` wird dann z. B. zu P0001, P0042 usw. (gleiche Logik wie project_nr).
3. **Commitments/Actuals danach importieren**: Die Spalte project_nr wird mit derselben Logik anonymisiert (z. B. PRJ-A → P0042). Der Service sucht/erstellt ein Projekt mit `name = P0042` und ordnet die Zeile diesem Projekt zu.

So bleiben Projekte und ihre Commitments/Actuals auch nach Anonymisierung korrekt verknüpft.

## Technische Details

- **ProjectLinker** (`backend/services/project_linker.py`): `get_or_create_project(project_nr, wbs_element)` sucht `projects.name = project_nr` und legt bei Bedarf ein Projekt an.
- **ActualsCommitmentsImportService**: Ruft für jede Zeile `_get_or_create_project_cached(project_nr, wbs_element)` auf und setzt `project_id` und `project_nr` im gespeicherten Datensatz.
- **AnonymizerService**: `_project_nr_deterministic(project_nr)` bildet jede Projektnummer per Hash auf ein festes P0001–P9999 ab, damit Projekt-Import und Commitments/Actuals-Import dieselben Pxxxx-Werte verwenden und die Zuordnung stimmt.
