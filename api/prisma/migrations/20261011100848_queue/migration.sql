-- CreateEnum
CREATE TYPE "TurnStatus" AS ENUM ('WAITING', 'CALLED', 'DONE', 'NO_SHOW', 'CANCELLED');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "businessType" TEXT;

-- CreateTable
CREATE TABLE "Section" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "siteId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turn" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "serviceDate" TEXT NOT NULL,
    "status" "TurnStatus" NOT NULL DEFAULT 'WAITING',
    "sectionId" INTEGER NOT NULL,
    "siteId" INTEGER,
    "counterId" INTEGER,
    "calledById" INTEGER,
    "publicToken" TEXT NOT NULL,
    "recallCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Turn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CounterToSection" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CounterToSection_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Section_isDeleted_idx" ON "Section"("isDeleted");

-- CreateIndex
CREATE INDEX "Counter_isDeleted_idx" ON "Counter"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "Turn_publicToken_key" ON "Turn"("publicToken");

-- CreateIndex
CREATE INDEX "Turn_serviceDate_status_idx" ON "Turn"("serviceDate", "status");

-- CreateIndex
CREATE INDEX "Turn_siteId_serviceDate_idx" ON "Turn"("siteId", "serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "Turn_sectionId_siteId_serviceDate_number_key" ON "Turn"("sectionId", "siteId", "serviceDate", "number");

-- CreateIndex
CREATE INDEX "_CounterToSection_B_index" ON "_CounterToSection"("B");

-- AddForeignKey
ALTER TABLE "Counter" ADD CONSTRAINT "Counter_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "Counter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_calledById_fkey" FOREIGN KEY ("calledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CounterToSection" ADD CONSTRAINT "_CounterToSection_A_fkey" FOREIGN KEY ("A") REFERENCES "Counter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CounterToSection" ADD CONSTRAINT "_CounterToSection_B_fkey" FOREIGN KEY ("B") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
