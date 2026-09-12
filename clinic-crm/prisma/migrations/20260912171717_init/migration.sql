-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'RECEPTIONIST', 'THERAPIST', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('LEAD', 'ACTIVE', 'DORMANT', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('WALK_IN', 'PHONE', 'WHATSAPP', 'INSTAGRAM', 'WEBSITE', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "InvoiceItemKind" AS ENUM ('SERVICE', 'PRODUCT', 'PACKAGE', 'GIFT_CARD', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'GIFT_CARD', 'PACKAGE_CREDIT', 'LOYALTY_POINTS');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('NONE', 'PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('RETAIL', 'PROFESSIONAL', 'BOTH');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'RETAIL_SALE', 'TREATMENT_USE', 'INTERNAL_USE', 'ADJUSTMENT', 'RETURN_TO_SUPPLIER', 'CUSTOMER_RETURN', 'WASTAGE', 'EXPIRY', 'STOCK_TAKE');

-- CreateEnum
CREATE TYPE "ConsumptionBillStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClientPackageStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('SMS', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MessagePurpose" AS ENUM ('APPOINTMENT_REMINDER', 'APPOINTMENT_CONFIRMATION', 'APPOINTMENT_CANCELLATION', 'BIRTHDAY', 'WIN_BACK', 'CAMPAIGN', 'AFTERCARE', 'MANUAL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'SIGNED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "LoyaltyReason" AS ENUM ('EARNED_PURCHASE', 'REDEEMED', 'MANUAL_ADJUSTMENT', 'EXPIRED', 'REFERRAL_BONUS');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('BEFORE_PHOTO', 'AFTER_PHOTO', 'CONSENT_FORM', 'ID_DOCUMENT', 'PRESCRIPTION', 'LAB_RESULT', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'RECEPTIONIST',
    "title" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "colorHex" TEXT NOT NULL DEFAULT '#8b5cf6',
    "isBookable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "commissionBps" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingHour" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WorkingHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "birthDate" TIMESTAMP(3),
    "gender" "Gender" NOT NULL DEFAULT 'UNDISCLOSED',
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "address" TEXT,
    "city" TEXT,
    "nationalId" TEXT,
    "occupation" TEXT,
    "source" "BookingSource" NOT NULL DEFAULT 'WALK_IN',
    "referredById" TEXT,
    "skinType" TEXT,
    "allergies" TEXT,
    "medicalNotes" TEXT,
    "medications" TEXT,
    "preferences" TEXT,
    "internalNotes" TEXT,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "marketingSms" BOOLEAN NOT NULL DEFAULT false,
    "marketingEmail" BOOLEAN NOT NULL DEFAULT false,
    "marketingWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "kvkkConsentAt" TIMESTAMP(3),
    "firstVisitAt" TIMESTAMP(3),
    "lastVisitAt" TIMESTAMP(3),
    "totalSpentMinor" INTEGER NOT NULL DEFAULT 0,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "noShowCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL DEFAULT '#64748b',

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientTag" (
    "clientId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ClientTag_pkey" PRIMARY KEY ("clientId","tagId")
);

-- CreateTable
CREATE TABLE "ClientNote" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authorId" TEXT,
    "appointmentId" TEXT,
    "body" TEXT NOT NULL,
    "isClinical" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientDocument" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "kind" "DocumentKind" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "status" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "signedAt" TIMESTAMP(3),
    "signatureData" TEXT,
    "documentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL DEFAULT '#0ea5e9',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMin" INTEGER NOT NULL,
    "bufferMin" INTEGER NOT NULL DEFAULT 0,
    "priceMinor" INTEGER NOT NULL,
    "costMinor" INTEGER NOT NULL DEFAULT 0,
    "commissionBps" INTEGER,
    "colorHex" TEXT NOT NULL DEFAULT '#0ea5e9',
    "requiresPatchTest" BOOLEAN NOT NULL DEFAULT false,
    "patchTestDays" INTEGER NOT NULL DEFAULT 0,
    "requiresConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentTemplateId" TEXT,
    "aftercareNote" TEXT,
    "isOnlineBookable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceStaff" (
    "serviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ServiceStaff_pkey" PRIMARY KEY ("serviceId","userId")
);

-- CreateTable
CREATE TABLE "ServiceRoom" (
    "serviceId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,

    CONSTRAINT "ServiceRoom_pkey" PRIMARY KEY ("serviceId","roomId")
);

-- CreateTable
CREATE TABLE "ServiceProductUsage" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ServiceProductUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMinor" INTEGER NOT NULL,
    "validityDays" INTEGER NOT NULL DEFAULT 365,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "PackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPackage" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "status" "ClientPackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "pricePaidMinor" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ClientPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPackageItem" (
    "id" TEXT NOT NULL,
    "clientPackageId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "totalQty" INTEGER NOT NULL,
    "usedQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClientPackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageRedemption" (
    "id" TEXT NOT NULL,
    "clientPackageId" TEXT NOT NULL,
    "clientPackageItemId" TEXT NOT NULL,
    "appointmentServiceId" TEXT,
    "invoiceItemId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "valueMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "roomId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "source" "BookingSource" NOT NULL DEFAULT 'PHONE',
    "notes" TEXT,
    "internalNotes" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "depositMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentService" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "staffId" TEXT,
    "durationMin" INTEGER NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AppointmentService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT,
    "appointmentId" TEXT,
    "cashierId" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "discountType" "DiscountType" NOT NULL DEFAULT 'NONE',
    "discountValue" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "taxBps" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "paidMinor" INTEGER NOT NULL DEFAULT 0,
    "refundedMinor" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "kind" "InvoiceItemKind" NOT NULL,
    "description" TEXT NOT NULL,
    "serviceId" TEXT,
    "productId" TEXT,
    "packageId" TEXT,
    "giftCardId" TEXT,
    "appointmentServiceId" TEXT,
    "staffId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPriceMinor" INTEGER NOT NULL,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,
    "costMinor" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "reference" TEXT,
    "giftCardId" TEXT,
    "receivedById" TEXT,
    "isRefund" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "baseMinor" INTEGER NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "initialMinor" INTEGER NOT NULL,
    "balanceMinor" INTEGER NOT NULL,
    "buyerClientId" TEXT,
    "recipientName" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyEntry" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "points" INTEGER NOT NULL,
    "reason" "LoyaltyReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "categoryId" TEXT,
    "supplierId" TEXT,
    "type" "ProductType" NOT NULL DEFAULT 'PROFESSIONAL',
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "unitsPerPack" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "costMinor" INTEGER NOT NULL DEFAULT 0,
    "retailMinor" INTEGER NOT NULL DEFAULT 0,
    "stockQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trackStock" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "location" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "unitCostMinor" INTEGER NOT NULL DEFAULT 0,
    "totalCostMinor" INTEGER NOT NULL DEFAULT 0,
    "reference" TEXT,
    "note" TEXT,
    "userId" TEXT,
    "appointmentId" TEXT,
    "invoiceId" TEXT,
    "consumptionBillId" TEXT,
    "stockCountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumptionBill" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "ConsumptionBillStatus" NOT NULL DEFAULT 'DRAFT',
    "billDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "costCenter" TEXT,
    "staffId" TEXT,
    "roomId" TEXT,
    "appointmentId" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "totalCostMinor" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsumptionBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumptionBillItem" (
    "id" TEXT NOT NULL,
    "consumptionBillId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCostMinor" INTEGER NOT NULL,
    "totalCostMinor" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "ConsumptionBillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countedById" TEXT,
    "notes" TEXT,
    "isPosted" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountItem" (
    "id" TEXT NOT NULL,
    "stockCountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedQty" DOUBLE PRECISION NOT NULL,
    "countedQty" DOUBLE PRECISION NOT NULL,
    "varianceQty" DOUBLE PRECISION NOT NULL,
    "note" TEXT,

    CONSTRAINT "StockCountItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "purpose" "MessagePurpose" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "appointmentId" TEXT,
    "campaignId" TEXT,
    "templateId" TEXT,
    "channel" "MessageChannel" NOT NULL,
    "purpose" "MessagePurpose" NOT NULL DEFAULT 'MANUAL',
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "toAddress" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "providerId" TEXT,
    "error" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "templateId" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "filter" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Beauty Clinic',
    "legalName" TEXT,
    "taxNumber" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "logoUrl" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "currencySymbol" TEXT NOT NULL DEFAULT '₺',
    "locale" TEXT NOT NULL DEFAULT 'tr-TR',
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "defaultTaxBps" INTEGER NOT NULL DEFAULT 2000,
    "slotMinutes" INTEGER NOT NULL DEFAULT 15,
    "openMin" INTEGER NOT NULL DEFAULT 540,
    "closeMin" INTEGER NOT NULL DEFAULT 1200,
    "reminderHoursBefore" INTEGER NOT NULL DEFAULT 24,
    "secondReminderHoursBefore" INTEGER DEFAULT 2,
    "loyaltyPointsPerUnit" INTEGER NOT NULL DEFAULT 1,
    "loyaltyUnitMinor" INTEGER NOT NULL DEFAULT 10000,
    "loyaltyPointValueMinor" INTEGER NOT NULL DEFAULT 100,
    "cancellationWindowH" INTEGER NOT NULL DEFAULT 24,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_isActive_isBookable_idx" ON "User"("isActive", "isBookable");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "WorkingHour_userId_weekday_idx" ON "WorkingHour"("userId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "WorkingHour_userId_weekday_startMin_key" ON "WorkingHour"("userId", "weekday", "startMin");

-- CreateIndex
CREATE INDEX "TimeOff_userId_startAt_idx" ON "TimeOff"("userId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Room_name_key" ON "Room"("name");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Client_phone_key" ON "Client"("phone");

-- CreateIndex
CREATE INDEX "Client_lastName_firstName_idx" ON "Client"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Client_status_isDeleted_idx" ON "Client"("status", "isDeleted");

-- CreateIndex
CREATE INDEX "Client_lastVisitAt_idx" ON "Client"("lastVisitAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "ClientNote_clientId_createdAt_idx" ON "ClientNote"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientDocument_clientId_kind_idx" ON "ClientDocument"("clientId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentTemplate_name_key" ON "ConsentTemplate"("name");

-- CreateIndex
CREATE INDEX "ConsentRecord_clientId_status_idx" ON "ConsentRecord"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_name_key" ON "ServiceCategory"("name");

-- CreateIndex
CREATE INDEX "Service_isActive_idx" ON "Service"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Service_categoryId_name_key" ON "Service"("categoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProductUsage_serviceId_productId_key" ON "ServiceProductUsage"("serviceId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Package_name_key" ON "Package"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PackageItem_packageId_serviceId_key" ON "PackageItem"("packageId", "serviceId");

-- CreateIndex
CREATE INDEX "ClientPackage_clientId_status_idx" ON "ClientPackage"("clientId", "status");

-- CreateIndex
CREATE INDEX "ClientPackage_expiresAt_idx" ON "ClientPackage"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPackageItem_clientPackageId_serviceId_key" ON "ClientPackageItem"("clientPackageId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageRedemption_appointmentServiceId_key" ON "PackageRedemption"("appointmentServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageRedemption_invoiceItemId_key" ON "PackageRedemption"("invoiceItemId");

-- CreateIndex
CREATE INDEX "PackageRedemption_clientPackageId_idx" ON "PackageRedemption"("clientPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_code_key" ON "Appointment"("code");

-- CreateIndex
CREATE INDEX "Appointment_startAt_staffId_idx" ON "Appointment"("startAt", "staffId");

-- CreateIndex
CREATE INDEX "Appointment_clientId_startAt_idx" ON "Appointment"("clientId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_status_startAt_idx" ON "Appointment"("status", "startAt");

-- CreateIndex
CREATE INDEX "AppointmentService_appointmentId_idx" ON "AppointmentService"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_appointmentId_key" ON "Invoice"("appointmentId");

-- CreateIndex
CREATE INDEX "Invoice_status_issuedAt_idx" ON "Invoice"("status", "issuedAt");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceItem_appointmentServiceId_key" ON "InvoiceItem"("appointmentServiceId");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Commission_userId_createdAt_idx" ON "Commission"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_code_key" ON "GiftCard"("code");

-- CreateIndex
CREATE INDEX "LoyaltyEntry_clientId_createdAt_idx" ON "LoyaltyEntry"("clientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");

-- CreateIndex
CREATE INDEX "Product_isActive_type_idx" ON "Product"("isActive", "type");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_type_createdAt_idx" ON "StockMovement"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumptionBill_number_key" ON "ConsumptionBill"("number");

-- CreateIndex
CREATE INDEX "ConsumptionBill_status_billDate_idx" ON "ConsumptionBill"("status", "billDate");

-- CreateIndex
CREATE INDEX "ConsumptionBillItem_consumptionBillId_idx" ON "ConsumptionBillItem"("consumptionBillId");

-- CreateIndex
CREATE UNIQUE INDEX "StockCount_number_key" ON "StockCount"("number");

-- CreateIndex
CREATE UNIQUE INDEX "StockCountItem_stockCountId_productId_key" ON "StockCountItem"("stockCountId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_name_key" ON "MessageTemplate"("name");

-- CreateIndex
CREATE INDEX "MessageLog_status_scheduledFor_idx" ON "MessageLog"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "MessageLog_clientId_createdAt_idx" ON "MessageLog"("clientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRecipient_campaignId_clientId_key" ON "CampaignRecipient"("campaignId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSequence_prefix_year_key" ON "DocumentSequence"("prefix", "year");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkingHour" ADD CONSTRAINT "WorkingHour_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTag" ADD CONSTRAINT "ClientTag_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTag" ADD CONSTRAINT "ClientTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ConsentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_consentTemplateId_fkey" FOREIGN KEY ("consentTemplateId") REFERENCES "ConsentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStaff" ADD CONSTRAINT "ServiceStaff_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStaff" ADD CONSTRAINT "ServiceStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRoom" ADD CONSTRAINT "ServiceRoom_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRoom" ADD CONSTRAINT "ServiceRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProductUsage" ADD CONSTRAINT "ServiceProductUsage_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProductUsage" ADD CONSTRAINT "ServiceProductUsage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackageItem" ADD CONSTRAINT "ClientPackageItem_clientPackageId_fkey" FOREIGN KEY ("clientPackageId") REFERENCES "ClientPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackageItem" ADD CONSTRAINT "ClientPackageItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRedemption" ADD CONSTRAINT "PackageRedemption_clientPackageId_fkey" FOREIGN KEY ("clientPackageId") REFERENCES "ClientPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRedemption" ADD CONSTRAINT "PackageRedemption_clientPackageItemId_fkey" FOREIGN KEY ("clientPackageItemId") REFERENCES "ClientPackageItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRedemption" ADD CONSTRAINT "PackageRedemption_appointmentServiceId_fkey" FOREIGN KEY ("appointmentServiceId") REFERENCES "AppointmentService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRedemption" ADD CONSTRAINT "PackageRedemption_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_appointmentServiceId_fkey" FOREIGN KEY ("appointmentServiceId") REFERENCES "AppointmentService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_buyerClientId_fkey" FOREIGN KEY ("buyerClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyEntry" ADD CONSTRAINT "LoyaltyEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyEntry" ADD CONSTRAINT "LoyaltyEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_consumptionBillId_fkey" FOREIGN KEY ("consumptionBillId") REFERENCES "ConsumptionBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "StockCount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionBill" ADD CONSTRAINT "ConsumptionBill_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionBill" ADD CONSTRAINT "ConsumptionBill_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionBill" ADD CONSTRAINT "ConsumptionBill_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionBill" ADD CONSTRAINT "ConsumptionBill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionBillItem" ADD CONSTRAINT "ConsumptionBillItem_consumptionBillId_fkey" FOREIGN KEY ("consumptionBillId") REFERENCES "ConsumptionBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionBillItem" ADD CONSTRAINT "ConsumptionBillItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
