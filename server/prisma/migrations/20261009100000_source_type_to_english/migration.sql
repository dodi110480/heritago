-- Data migration: unify `sourceType` values from German to English.
-- `sourceType` was the only enum stored in German; all other enums are already English.
-- 'AUDIO' and 'VIDEO' are unchanged (already English).

UPDATE "Source" SET "sourceType" = 'BOOK'          WHERE "sourceType" = 'BUCH';
UPDATE "Source" SET "sourceType" = 'WEBSITE'       WHERE "sourceType" = 'WEBSEITE';
UPDATE "Source" SET "sourceType" = 'DOCUMENT'      WHERE "sourceType" = 'DOKUMENT';
UPDATE "Source" SET "sourceType" = 'NEWSPAPER'     WHERE "sourceType" = 'ZEITUNG';
UPDATE "Source" SET "sourceType" = 'ARCHIVE'       WHERE "sourceType" = 'ARCHIV';
UPDATE "Source" SET "sourceType" = 'PHOTO'         WHERE "sourceType" = 'FOTO';
UPDATE "Source" SET "sourceType" = 'PERIODICAL'    WHERE "sourceType" = 'PERIODISCH';
UPDATE "Source" SET "sourceType" = 'CHURCH_RECORD' WHERE "sourceType" = 'KIRCHBUCH';
UPDATE "Source" SET "sourceType" = 'CENSUS'        WHERE "sourceType" = 'VOLKSZAEHLUNG';
UPDATE "Source" SET "sourceType" = 'OTHER'         WHERE "sourceType" = 'ANDERE';
