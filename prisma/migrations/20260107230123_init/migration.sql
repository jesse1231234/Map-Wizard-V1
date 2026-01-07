-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wizardId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "stepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "questionId" TEXT,
    "verdict" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubric" (
    "id" TEXT NOT NULL,
    "wizardId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "stepId" TEXT NOT NULL,
    "json" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicLinkToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardConfig" (
    "id" TEXT NOT NULL,
    "wizardId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "json" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_wizardId_version_idx" ON "Session"("wizardId", "version");

-- CreateIndex
CREATE INDEX "Answer_sessionId_stepId_idx" ON "Answer"("sessionId", "stepId");

-- CreateIndex
CREATE INDEX "Answer_sessionId_stepId_questionId_idx" ON "Answer"("sessionId", "stepId", "questionId");

-- CreateIndex
CREATE INDEX "Feedback_sessionId_stepId_idx" ON "Feedback"("sessionId", "stepId");

-- CreateIndex
CREATE INDEX "Rubric_wizardId_version_stepId_idx" ON "Rubric"("wizardId", "version", "stepId");

-- CreateIndex
CREATE INDEX "Comment_sessionId_stepId_idx" ON "Comment"("sessionId", "stepId");

-- CreateIndex
CREATE UNIQUE INDEX "MagicLinkToken_tokenHash_key" ON "MagicLinkToken"("tokenHash");

-- CreateIndex
CREATE INDEX "MagicLinkToken_userId_idx" ON "MagicLinkToken"("userId");

-- CreateIndex
CREATE INDEX "MagicLinkToken_expiresAt_idx" ON "MagicLinkToken"("expiresAt");

-- CreateIndex
CREATE INDEX "WizardConfig_wizardId_version_idx" ON "WizardConfig"("wizardId", "version");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicLinkToken" ADD CONSTRAINT "MagicLinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
