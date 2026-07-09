-- CreateTable
CREATE TABLE "family_groups" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_memberships" (
    "id" TEXT NOT NULL,
    "family_group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_invites" (
    "id" TEXT NOT NULL,
    "family_group_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),

    CONSTRAINT "family_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "family_groups_owner_id_key" ON "family_groups"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "family_memberships_user_id_key" ON "family_memberships"("user_id");

-- CreateIndex
CREATE INDEX "idx_family_memberships_group" ON "family_memberships"("family_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "family_invites_token_key" ON "family_invites"("token");

-- CreateIndex
CREATE INDEX "idx_family_invites_group" ON "family_invites"("family_group_id");

-- AddForeignKey
ALTER TABLE "family_groups" ADD CONSTRAINT "family_groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_memberships" ADD CONSTRAINT "family_memberships_family_group_id_fkey" FOREIGN KEY ("family_group_id") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_memberships" ADD CONSTRAINT "family_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_invites" ADD CONSTRAINT "family_invites_family_group_id_fkey" FOREIGN KEY ("family_group_id") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
