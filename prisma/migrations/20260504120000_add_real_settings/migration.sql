-- User-level preferences
ALTER TABLE "User"
ADD COLUMN "phone" TEXT,
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en-IN',
ADD COLUMN "dateFormat" TEXT NOT NULL DEFAULT 'dd MMM yyyy',
ADD COLUMN "themePreference" TEXT NOT NULL DEFAULT 'dark',
ADD COLUMN "densityPreference" TEXT NOT NULL DEFAULT 'comfortable',
ADD COLUMN "defaultMessageLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN "defaultLandingPage" TEXT NOT NULL DEFAULT 'org';

-- Organization-level settings
ALTER TABLE "Organization"
ADD COLUMN "legalName" TEXT,
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN "weekStartsOn" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "paymentGraceDays" INTEGER NOT NULL DEFAULT 0;

-- Branch-level operational settings
ALTER TABLE "Branch"
ADD COLUMN "address" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "openingTime" TEXT,
ADD COLUMN "closingTime" TEXT,
ADD COLUMN "defaultAdmissionFee" INTEGER DEFAULT 0,
ADD COLUMN "defaultMessageLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN "reminderTone" TEXT NOT NULL DEFAULT 'polite',
ADD COLUMN "aiEnabled" BOOLEAN NOT NULL DEFAULT true;
