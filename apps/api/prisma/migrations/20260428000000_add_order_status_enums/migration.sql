-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('ordered', 'shipped', 'cancelled', 'returned', 'pending');

-- CreateEnum
CREATE TYPE "StatusChangeSource" AS ENUM ('system', 'user', 'retailer', 'webhook', 'admin');

-- AlterTable: Add status column to Order if it does not already exist
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "status" "OrderStatus" NOT NULL DEFAULT 'ordered';

-- AlterTable: Add source column to OrderStatusHistory if table exists
ALTER TABLE "OrderStatusHistory" ADD COLUMN IF NOT EXISTS "source" "StatusChangeSource";