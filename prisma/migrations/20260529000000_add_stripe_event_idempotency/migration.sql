-- Idempotencia de webhooks Stripe. Stripe reintenta cada evento hasta 3
-- dias si el endpoint no responde 200 rapido; cacheamos el event.id
-- para no duplicar emails ni mutaciones de subscription en reintentos.

CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StripeEvent_processedAt_idx" ON "StripeEvent"("processedAt");
