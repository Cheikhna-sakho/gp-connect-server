-- Conversation.missionId becomes optional (mission created only on offer acceptance)
ALTER TABLE "conversations" ALTER COLUMN "mission_id" DROP NOT NULL;

-- Activate the ConversationStatus enum that was declared but unused
ALTER TABLE "conversations"
  ADD COLUMN "status" "ConversationStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "last_message_at" TIMESTAMP(3);

-- Message.content becomes optional (OFFER and MEDIA messages have no text content)
ALTER TABLE "messages" ALTER COLUMN "content" DROP NOT NULL;
