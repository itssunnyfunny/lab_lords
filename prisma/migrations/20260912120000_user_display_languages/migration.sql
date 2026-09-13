-- Personal presentation preferences only; no financial or messaging history changes.
ALTER TABLE "User"
ADD COLUMN "interfaceLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN "documentLanguage" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "User" ADD CONSTRAINT "User_interfaceLanguage_check"
CHECK ("interfaceLanguage" IN ('en', 'hi', 'hinglish'));
ALTER TABLE "User" ADD CONSTRAINT "User_documentLanguage_check"
CHECK ("documentLanguage" IN ('en', 'hi', 'hinglish'));
