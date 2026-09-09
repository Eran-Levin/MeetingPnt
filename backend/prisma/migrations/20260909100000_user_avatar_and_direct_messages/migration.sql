-- A photo the user takes of themselves, so a roster reads as faces rather than a column of names.
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;

-- One-to-one conversation, keyed by the pair rather than by any group or activity.
CREATE TABLE "direct_messages" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "body" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

-- Both orderings: a thread is read from either side.
CREATE INDEX "direct_messages_sender_id_recipient_id_created_at_idx" ON "direct_messages"("sender_id", "recipient_id", "created_at");
CREATE INDEX "direct_messages_recipient_id_sender_id_created_at_idx" ON "direct_messages"("recipient_id", "sender_id", "created_at");

ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
