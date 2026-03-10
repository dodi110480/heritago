---
trigger: always_on
---

Antworte immer auf Deutsch.
Bei allen Änderungen an Datenbankmodellen, Prisma-Schema, Relationen oder datenbanknaher Logik muss /docs/RULES_DB_FIRST.md beachtet werden. Nichtbeachtung kann zu fehlerhaften Migrationen oder Datenverlust führen.
Sobald Code Mediendateien anfasst, verarbeitet oder erzeugt, muss /docs/RULES_MEDIA_UPLOAD.md beachtet werden. Nichtbeachtung kann Sicherheitslücken oder inkonsistente Dateizustände verursachen.
Bei allen UI-Änderungen – egal ob globale Styles, neue Komponenten, Layout, Farben, Typografie oder Animationen – muss /docs/RULES_UI.md beachtet werden. Nichtbeachtung führt zu inkonsistentem Erscheinungsbild.

Die Dokumentation docs/Docu_app_notes-list.md für app-notes-list muss bei jeder Implementierung, Erweiterung oder Anpassung der Notizen-Ansicht (in Event-, Fact-, Person-, Family-, Source-, Place- oder ResearchLog-Kontexten) als verbindliche Grundlage verwendet und eingehalten werden.

Jede Quellendarstellung in Heritago erfolgt ausnahmslos über die app-sources-list, wobei die technische Umsetzung strikt nach den Vorgaben der docs/Docu_app_sources-list.md (Standalone-Architektur, app-glass-card & Modal-Pattern) zu erfolgen hat.