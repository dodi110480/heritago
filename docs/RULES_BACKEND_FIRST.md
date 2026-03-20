# RULES_BACKEND_FIRST

Alle Datenverarbeitung, Formatierung und komplexe Logik muss im Backend erfolgen. Das Frontend dient rein als View-Layer ("Lean Frontend").

## Kernregeln

- **Keine Berechnungen im Frontend**: Wenn Daten für die Anzeige kombiniert, gefiltert oder transformiert werden müssen, geschieht dies im Backend-Service.
- **Pre-formatted Display Data**: Datumsangaben, Labels (z.B. 'Heute', 'Gestern') und Status-Texte werden vom Backend bereits übersetzt und formatiert geliefert (z.B. in `formattedNotes` oder `formattedCitations`).
- **Backend-Driven UI Configuration**: Icons, Farben und CSS-Klassen für Status-Anzeigen sollten im Backend definiert werden, um Konsistenz zu gewährleisten.
- **Kein Client-side Date-Handling**: Vermeide `new Date()` im Frontend für geschäftslogische Berechnungen oder Formatierungen. Nutze die vom Backend bereitgestellten Strings.

## Ziel
Ein schlankes Frontend, das stabil gegenüber Änderungen an der Datenstruktur bleibt und keine Geschäftslogik enthält.
