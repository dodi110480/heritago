# 🌳 Heritago

![Heritago Hero Banner](docs/assets/hero-banner.png)

**Heritago** ist eine hochmoderne, webbasierte Genealogie-Plattform, die Eleganz mit technischer Präzision verbindet. Entwickelt für Familienforscher, die Wert auf erstklassige User Experience und strikte Einhaltung moderner Standards legen.

---

## ✨ Highlights

*   **Premium UI/UX**: Ein flüssiges Interface im Glassmorphismus-Design, optimiert für schnelles Arbeiten und ästhetische Freude.
*   **Volle GEDCOM 7.0 Kompatibilität**: Zukunftssichere Datenhaltung nach dem aktuellsten Industriestandard.
*   **Intelligentes Medien-Management**: Integriertes Zuschneiden (Cropping), Varianten-Generierung und nahtlose Verknüpfung mit Personen, Quellen und Ereignissen.
*   **Orts-Hierarchien & Mapping**: Verwaltung komplexer Ortsstrukturen mit automatischer Geokodierung und visueller Darstellung.
*   **Reaktive Architektur**: Blitzschnelle UI-Updates dank Angular Signals – keine unnötigen Wartezeiten.

---

## 🚀 Technische Features

### Frontend (Modern Angular)
- **Framework**: Angular 19+ mit Standalone Components.
- **State Management**: Konsequente Nutzung von **Signals** für maximale Performance.
- **Design**: Vanilla CSS mit Fokus auf moderne Aesthetics (Gradients, Blur-Effekte, Micro-Animations).

### Backend (Robust & Skalierbar)
- **Runtime**: Node.js mit Express.
- **Datenbank**: PostgreSQL via **Prisma ORM** für typsichere Abfragen.
- **Dateisystem**: Strukturiertes Storage-System für Originalmedien, Thumbnails und Dokumente.

---

## 🛠 Installation & Entwicklung

### Voraussetzungen
- Node.js (v18+)
- PostgreSQL Instanz

### Setup
1. Repository klonen:
   ```bash
   git clone https://github.com/dodi110480/heritago.git
   cd heritago
   ```
2. Abhängigkeiten installieren:
   ```bash
   npm install
   cd server && npm install
   ```
3. Umgebungsvariablen konfigurieren:
   Erstelle eine `.env` im `server` Verzeichnis mit `DATABASE_URL`.
4. Datenbank migrieren:
   ```bash
   npx prisma migrate dev
   ```
5. Development Server starten:
   ```bash
   # Im Hauptverzeichnis
   npm run dev
   ```

---

## 📜 Standards & Compliance

Dieses Projekt folgt strikt der **FamilySearch GEDCOM 7.0** Spezifikation. Jede Erweiterung des Datenmodells wird gegen diese Standards geprüft, um maximale Interoperabilität zu gewährleisten.

---

## 🛡 Lizenz

© 2026 Heritago Team. Alle Rechte vorbehalten.
