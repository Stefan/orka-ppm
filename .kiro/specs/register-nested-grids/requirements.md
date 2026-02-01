# Requirements Document: Register Nested Grids

## Introduction

Dieses Feature ermöglicht Expand-Rows in Registers (Kostenbuch-Projekten), um verknüpfte Items (Tasks, Registers, Cost Book Data) inline anzuzeigen. Die Funktion ist Admin-konfigurierbar mit Columns/Order, Permissions und Refresh on Return. Das Feature integriert "10x besser" Funktionen wie AI-Auto-Konfiguration, Inline-Editing, Drag&Drop und Dynamic Filters.

## Glossary

- **Register**: Ein Kostenbuch-Projekt im System
- **Nested_Grid**: Ein eingebettetes Grid, das verknüpfte Items innerhalb einer erweiterten Row anzeigt
- **Admin_Panel**: Die Administrationsoberfläche zur Konfiguration von Nested Grids
- **Linked_Items**: Verknüpfte Datensätze wie Tasks, Registers oder Cost Book Data
- **Item_Type**: Die Kategorie der verknüpften Items (Tasks, Registers, Cost Registers)
- **Section**: Eine konfigurierbare Gruppe von Nested Grid Einstellungen
- **Expand_Row**: Eine Grid-Row, die durch Klick auf ein Chevron-Icon erweitert werden kann
- **AI_Suggestions**: Automatisch generierte Vorschläge für Column-Konfigurationen basierend auf Datenanalyse
- **Multi_Level_Nesting**: Die Fähigkeit, Nested Grids bis zu 2 Ebenen tief zu verschachteln
- **Scroll_Position**: Die aktuelle Scroll-Position im Grid, die beim Return erhalten bleiben soll
- **Permission_System**: Das Berechtigungssystem, das View-Rechte für Nested Grids kontrolliert

## Requirements

### Requirement 1: Admin Panel für Nested Grid Konfiguration

**User Story:** Als Administrator möchte ich ein "Nested Grids"-Tab im Admin-Bereich für Registers konfigurieren, so dass ich die Anzeige von verknüpften Items steuern kann.

#### Acceptance Criteria

1. WHEN ein Administrator das Register Admin Panel öffnet, THE Admin_Panel SHALL einen "Nested Grids"-Tab anzeigen
2. WHEN "Enable Linked Items" für ein Register deaktiviert ist, THE Admin_Panel SHALL den "Nested Grids"-Tab als read-only anzeigen
3. WHEN "Enable Linked Items" für ein Register aktiviert ist, THE Admin_Panel SHALL alle Nested Grid Konfigurationsoptionen editierbar machen
4. THE Admin_Panel SHALL eine klare visuelle Unterscheidung zwischen editierbarem und read-only Zustand bereitstellen

### Requirement 2: Section Management und Item Type Konfiguration

**User Story:** Als Administrator möchte ich Sections hinzufügen/entfernen und Item Types mit Columns konfigurieren, so dass ich die Nested Grid Anzeige an meine Bedürfnisse anpassen kann.

#### Acceptance Criteria

1. WHEN ein Administrator eine neue Section hinzufügt, THE Admin_Panel SHALL die Section zur Konfigurationsliste hinzufügen
2. WHEN ein Administrator eine Section entfernt, THE Admin_Panel SHALL die Section aus der Konfiguration löschen und eine Bestätigung anfordern
3. WHEN ein Administrator einen Item Type auswählt, THE Admin_Panel SHALL die verfügbaren Item Types (Tasks, Registers, Cost Registers) als Optionen anzeigen
4. WHEN ein Administrator Columns für eine Section konfiguriert, THE Admin_Panel SHALL mindestens 10 verfügbare Columns zur Auswahl anbieten
5. WHEN ein Administrator die Display Order festlegt, THE Admin_Panel SHALL Drag&Drop Funktionalität für die Column-Reihenfolge bereitstellen
6. WHEN ein Administrator eine Section konfiguriert, THE Admin_Panel SHALL AI-generierte Vorschläge für beliebte Column-Kombinationen anzeigen

### Requirement 3: Dynamic Column Selector

**User Story:** Als Administrator möchte ich einen dynamischen Column-Selector haben, der sich basierend auf dem gewählten Item Type anpasst, so dass ich nur relevante Columns sehe.

#### Acceptance Criteria

1. WHEN ein Administrator den Item Type "Tasks" auswählt, THE Admin_Panel SHALL Task-spezifische Columns (Status, Due Date, Assignee, Priority, etc.) anzeigen
2. WHEN ein Administrator den Item Type "Registers" auswählt, THE Admin_Panel SHALL Register-spezifische Columns (Name, Budget, EAC, Variance, etc.) anzeigen
3. WHEN ein Administrator den Item Type "Cost Registers" auswählt, THE Admin_Panel SHALL Cost-spezifische Columns (EAC, Variance, Commitments, Actuals, etc.) anzeigen
4. WHEN der Item Type geändert wird, THE Admin_Panel SHALL die Column-Auswahl dynamisch aktualisieren und ungültige Selections entfernen

### Requirement 4: Nested Grid Display mit Multi-Level Nesting

**User Story:** Als Benutzer möchte ich Rows mit einem Chevron-Icon erweitern können, um Nested Grids mit konfigurierten Columns anzuzeigen, so dass ich verknüpfte Items inline sehen kann.

#### Acceptance Criteria

1. WHEN eine Row verknüpfte Items hat, THE Register_Grid SHALL ein Chevron-Icon am Anfang der Row anzeigen
2. WHEN ein Benutzer auf das Chevron-Icon klickt, THE Register_Grid SHALL die Row erweitern und das Nested_Grid mit konfigurierten Columns anzeigen
3. WHEN ein Nested_Grid angezeigt wird, THE Register_Grid SHALL ag-grid-react für die Darstellung verwenden
4. WHEN ein Nested_Grid Items enthält, die selbst verknüpfte Items haben, THE Nested_Grid SHALL ein Chevron-Icon für weitere Expansion anzeigen
5. THE Register_Grid SHALL Multi-Level Nesting bis zu 2 Ebenen tief unterstützen
6. WHEN ein Benutzer eine bereits erweiterte Row erneut klickt, THE Register_Grid SHALL die Row kollabieren und das Nested_Grid ausblenden

### Requirement 5: State Preservation und AI-Highlight Changes

**User Story:** Als Benutzer möchte ich beim Return zu einer View meine Scroll-Position behalten und über Änderungen informiert werden, so dass ich nahtlos weiterarbeiten kann.

#### Acceptance Criteria

1. WHEN ein Benutzer zu einer anderen View navigiert und zurückkehrt, THE Register_Grid SHALL die vorherige Scroll-Position wiederherstellen
2. WHEN ein Benutzer zu einer View mit erweiterten Nested Grids zurückkehrt, THE Register_Grid SHALL die Nested_Grid Daten refreshen
3. WHEN Änderungen in Nested Grid Items seit dem letzten View aufgetreten sind, THE Register_Grid SHALL AI-generierte Highlights für geänderte Items anzeigen
4. WHEN neue Items hinzugefügt wurden, THE Register_Grid SHALL eine Notification mit der Anzahl neuer Items anzeigen
5. THE Register_Grid SHALL Expand/Collapse State für alle Rows beim Navigation Return erhalten

### Requirement 6: Permission System mit AI-Alternativen

**User Story:** Als System möchte ich Nested Grids nur bei entsprechenden View-Rechten anzeigen, so dass Datensicherheit gewährleistet ist.

#### Acceptance Criteria

1. WHEN ein Benutzer keine View-Rechte für verknüpfte Items hat, THE Register_Grid SHALL das Chevron-Icon deaktiviert oder ausgeblendet anzeigen
2. WHEN ein Benutzer versucht, ein Nested_Grid ohne Berechtigung zu öffnen, THE Register_Grid SHALL eine Warning-Message mit Erklärung anzeigen
3. WHEN ein Benutzer keine View-Rechte hat, THE Register_Grid SHALL AI-generierte Alternativen anbieten (z.B. "Summary anzeigen statt Details")
4. THE Permission_System SHALL Permissions auf Section-Ebene prüfen, bevor Nested_Grid Daten geladen werden

### Requirement 7: Inline Editing in Nested Grids

**User Story:** Als Benutzer möchte ich Items direkt im Nested Grid editieren können, so dass ich keine Popups öffnen muss.

#### Acceptance Criteria

1. WHEN ein Benutzer Edit-Rechte für ein Item hat, THE Nested_Grid SHALL editierbare Cells mit visueller Kennzeichnung anzeigen
2. WHEN ein Benutzer eine Cell im Nested_Grid editiert, THE Nested_Grid SHALL die Änderung inline ohne Popup ermöglichen
3. WHEN ein Benutzer eine Änderung speichert, THE Nested_Grid SHALL die Änderung an das Backend senden und bei Erfolg die Cell aktualisieren
4. WHEN ein Fehler beim Speichern auftritt, THE Nested_Grid SHALL eine Fehlermeldung anzeigen und die vorherige Value wiederherstellen
5. THE Nested_Grid SHALL Validation Rules für editierbare Fields anwenden, bevor Änderungen gespeichert werden

### Requirement 8: Drag & Drop für Rows

**User Story:** Als Benutzer möchte ich Rows per Drag & Drop neu anordnen können, so dass ich die Reihenfolge flexibel anpassen kann.

#### Acceptance Criteria

1. WHEN ein Benutzer eine Row im Nested_Grid auswählt, THE Nested_Grid SHALL einen Drag-Handle anzeigen
2. WHEN ein Benutzer eine Row zieht, THE Nested_Grid SHALL visuelles Feedback für die Drop-Position anzeigen
3. WHEN ein Benutzer eine Row an einer neuen Position dropped, THE Nested_Grid SHALL die Row-Reihenfolge aktualisieren und an das Backend senden
4. WHEN die Reorder-Operation fehlschlägt, THE Nested_Grid SHALL die ursprüngliche Reihenfolge wiederherstellen und eine Fehlermeldung anzeigen
5. THE Nested_Grid SHALL Drag & Drop nur für Benutzer mit entsprechenden Edit-Rechten aktivieren

### Requirement 9: Dynamic Filters für Nested Grids

**User Story:** Als Benutzer möchte ich Dynamic Filters auf Nested Grids anwenden können, so dass ich relevante Items schnell finden kann.

#### Acceptance Criteria

1. WHEN ein Nested_Grid angezeigt wird, THE Nested_Grid SHALL eine Filter-Leiste mit konfigurierbaren Filtern anzeigen
2. WHEN ein Benutzer einen Filter anwendet, THE Nested_Grid SHALL nur Items anzeigen, die den Filter-Kriterien entsprechen
3. WHEN ein Benutzer mehrere Filter kombiniert, THE Nested_Grid SHALL Items anzeigen, die allen Filter-Kriterien entsprechen
4. WHEN ein Benutzer Filter entfernt, THE Nested_Grid SHALL alle Items wieder anzeigen
5. THE Nested_Grid SHALL Filter-State beim Navigation Return erhalten
6. THE Nested_Grid SHALL AI-Vorschläge für häufig verwendete Filter-Kombinationen anzeigen

### Requirement 10: Integration mit Costbook

**User Story:** Als Benutzer möchte ich im Costbook-Tab Projects-Grid als Nested-Register sehen, so dass ich zu Commitments/Actuals expandieren kann.

#### Acceptance Criteria

1. WHEN ein Benutzer den Costbook-Tab öffnet, THE Costbook_View SHALL das Projects-Grid mit Nested Grid Funktionalität anzeigen
2. WHEN ein Benutzer eine Project-Row expandiert, THE Projects_Grid SHALL Nested Grids für Commitments und Actuals anzeigen
3. WHEN ein Benutzer ein Commitment oder Actual expandiert, THE Nested_Grid SHALL weitere Details in einem zweiten Nesting-Level anzeigen
4. THE Costbook_View SHALL alle konfigurierten Nested Grid Features (Inline-Editing, Filters, Drag&Drop) unterstützen
