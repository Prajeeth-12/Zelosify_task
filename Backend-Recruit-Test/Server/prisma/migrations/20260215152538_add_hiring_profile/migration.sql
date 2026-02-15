-- CreateTable
CREATE TABLE "HiringProfile" (
    "id" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "s3Filename" TEXT NOT NULL,
    "s3Bucket" TEXT NOT NULL,
    "candidateSkills" TEXT[],
    "candidateExperience" DOUBLE PRECISION NOT NULL,
    "candidateLocation" TEXT NOT NULL,
    "jobRequiredSkills" TEXT[],
    "jobRequiredExperience" DOUBLE PRECISION NOT NULL,
    "jobRequiredLocation" TEXT NOT NULL,
    "skillMatchScore" DOUBLE PRECISION,
    "experienceMatchScore" DOUBLE PRECISION,
    "locationMatchScore" DOUBLE PRECISION,
    "finalScore" DOUBLE PRECISION,
    "confidence" TEXT,
    "reason" TEXT,
    "recommendationLatencyMs" DOUBLE PRECISION,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HiringProfile_tenantId_idx" ON "HiringProfile"("tenantId");

-- CreateIndex
CREATE INDEX "HiringProfile_userId_idx" ON "HiringProfile"("userId");

-- AddForeignKey
ALTER TABLE "HiringProfile" ADD CONSTRAINT "HiringProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringProfile" ADD CONSTRAINT "HiringProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
