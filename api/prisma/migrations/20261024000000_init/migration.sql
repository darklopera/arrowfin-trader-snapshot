-- CreateEnum
CREATE TYPE "Side" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "Liquidity" AS ENUM ('maker', 'taker');

-- CreateTable
CREATE TABLE "brokers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "white_label_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "brokers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traders" (
    "id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "kyc_status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "traders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "trader_id" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL,
    "max_position_size" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruments" (
    "symbol" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "point_value_usd" DECIMAL(14,2) NOT NULL,
    "tick_size" DECIMAL(12,6) NOT NULL,
    "tick_value_usd" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "market_prices" (
    "symbol" TEXT NOT NULL,
    "mark_price" DECIMAL(18,6) NOT NULL,
    "as_of" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "fills" (
    "id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "instrument_symbol" TEXT NOT NULL,
    "side" "Side" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(18,6) NOT NULL,
    "filled_at" TIMESTAMPTZ(3) NOT NULL,
    "order_id" TEXT NOT NULL,
    "liquidity" "Liquidity" NOT NULL,
    "commission_usd" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "fills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "traders_broker_id_idx" ON "traders"("broker_id");

-- CreateIndex
CREATE UNIQUE INDEX "traders_id_broker_id_key" ON "traders"("id", "broker_id");

-- CreateIndex
CREATE INDEX "accounts_broker_id_trader_id_idx" ON "accounts"("broker_id", "trader_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_id_broker_id_key" ON "accounts"("id", "broker_id");

-- CreateIndex
CREATE INDEX "fills_account_filled_at_id_idx" ON "fills"("account_id", "filled_at", "id");

-- CreateIndex
CREATE INDEX "fills_broker_id_order_id_idx" ON "fills"("broker_id", "order_id");

-- AddForeignKey
ALTER TABLE "traders" ADD CONSTRAINT "traders_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "brokers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "brokers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (composite: the trader must belong to the SAME broker as the account)
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_trader_id_broker_id_fkey" FOREIGN KEY ("trader_id", "broker_id") REFERENCES "traders"("id", "broker_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "instruments"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fills" ADD CONSTRAINT "fills_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "brokers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (composite: a fill can never point at another broker's account)
ALTER TABLE "fills" ADD CONSTRAINT "fills_account_id_broker_id_fkey" FOREIGN KEY ("account_id", "broker_id") REFERENCES "accounts"("id", "broker_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fills" ADD CONSTRAINT "fills_instrument_symbol_fkey" FOREIGN KEY ("instrument_symbol") REFERENCES "instruments"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;
