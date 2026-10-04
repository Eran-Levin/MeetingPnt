-- A roster slot for someone with no account of their own (e.g. a child in a party) — a real user
-- row so Rsvp/Attendance/GroupMember work unchanged, but nobody can log in as them.
ALTER TABLE "users" ADD COLUMN "is_placeholder" BOOLEAN NOT NULL DEFAULT false;

-- People who join as a unit rather than individually. rep_member_id has no Prisma relation field
-- going back to GroupMember — see the comment on Party in schema.prisma — but the FK still exists
-- here at the database level.
CREATE TABLE "parties" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT,
    "size" INTEGER NOT NULL,
    "rep_member_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "parties_group_id_idx" ON "parties"("group_id");

ALTER TABLE "parties" ADD CONSTRAINT "parties_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parties" ADD CONSTRAINT "parties_rep_member_id_fkey" FOREIGN KEY ("rep_member_id") REFERENCES "group_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "group_members" ADD COLUMN "party_id" TEXT;
CREATE INDEX "group_members_party_id_idx" ON "group_members"("party_id");
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- claims_user_id is the placeholder user this invitation will claim in place on acceptance,
-- for a party member who already has a roster slot waiting.
ALTER TABLE "invitations" ADD COLUMN "party_id" TEXT;
ALTER TABLE "invitations" ADD COLUMN "claims_user_id" TEXT;
CREATE INDEX "invitations_party_id_idx" ON "invitations"("party_id");
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_claims_user_id_fkey" FOREIGN KEY ("claims_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
