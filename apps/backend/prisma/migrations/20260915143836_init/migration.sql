-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `username` VARCHAR(32) NOT NULL,
    `display_name` VARCHAR(64) NOT NULL,
    `avatar_url` VARCHAR(512) NULL,
    `bio` VARCHAR(280) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `last_seen_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_users_email`(`email`),
    UNIQUE INDEX `uq_users_username`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `type` ENUM('DIRECT', 'GROUP') NOT NULL,
    `name` VARCHAR(100) NULL,
    `avatar_url` VARCHAR(512) NULL,
    `owner_id` BIGINT NULL,
    `direct_key` VARCHAR(40) NULL,
    `last_message_id` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_conversations_direct_key`(`direct_key`),
    INDEX `idx_conversations_owner`(`owner_id`),
    INDEX `idx_conversations_last_message`(`last_message_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_members` (
    `conversation_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `last_read_message_id` BIGINT NOT NULL DEFAULT 0,
    `muted_until` DATETIME(3) NULL,
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_members_user`(`user_id`),
    PRIMARY KEY (`conversation_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `conversation_id` BIGINT NOT NULL,
    `sender_id` BIGINT NOT NULL,
    `type` ENUM('TEXT', 'IMAGE', 'FILE', 'VOICE', 'SYSTEM') NOT NULL DEFAULT 'TEXT',
    `body` TEXT NULL,
    `reply_to_id` BIGINT NULL,
    `client_msg_id` CHAR(36) NOT NULL,
    `edited_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_messages_client_id`(`client_msg_id`),
    INDEX `idx_messages_conv`(`conversation_id`, `id` DESC),
    INDEX `idx_messages_sender`(`sender_id`),
    INDEX `idx_messages_reply_to`(`reply_to_id`),
    FULLTEXT INDEX `ft_messages_body`(`body`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attachments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `message_id` BIGINT NOT NULL,
    `object_key` VARCHAR(512) NOT NULL,
    `thumb_key` VARCHAR(512) NULL,
    `mime` VARCHAR(127) NOT NULL,
    `size` INTEGER UNSIGNED NOT NULL,
    `width` INTEGER UNSIGNED NULL,
    `height` INTEGER UNSIGNED NULL,
    `duration_ms` INTEGER UNSIGNED NULL,

    INDEX `idx_attachments_message`(`message_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reactions` (
    `message_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `emoji` VARCHAR(16) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_reactions_user`(`user_id`),
    PRIMARY KEY (`message_id`, `user_id`, `emoji`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `family_id` CHAR(36) NOT NULL,
    `user_agent` VARCHAR(255) NULL,
    `revoked_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_refresh_tokens_hash`(`token_hash`),
    INDEX `idx_refresh_tokens_user`(`user_id`),
    INDEX `idx_refresh_tokens_family`(`family_id`),
    INDEX `idx_refresh_tokens_expires`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `call_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `call_id` CHAR(36) NOT NULL,
    `conversation_id` BIGINT NOT NULL,
    `caller_id` BIGINT NOT NULL,
    `kind` ENUM('AUDIO', 'VIDEO') NOT NULL,
    `status` ENUM('MISSED', 'DECLINED', 'ENDED', 'BUSY') NOT NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ended_at` DATETIME(3) NULL,

    UNIQUE INDEX `uq_call_logs_call_id`(`call_id`),
    INDEX `idx_call_logs_conv`(`conversation_id`, `started_at` DESC),
    INDEX `idx_call_logs_caller`(`caller_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_last_message_id_fkey` FOREIGN KEY (`last_message_id`) REFERENCES `messages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_members` ADD CONSTRAINT `conversation_members_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_members` ADD CONSTRAINT `conversation_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_reply_to_id_fkey` FOREIGN KEY (`reply_to_id`) REFERENCES `messages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reactions` ADD CONSTRAINT `reactions_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reactions` ADD CONSTRAINT `reactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `call_logs` ADD CONSTRAINT `call_logs_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `call_logs` ADD CONSTRAINT `call_logs_caller_id_fkey` FOREIGN KEY (`caller_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
