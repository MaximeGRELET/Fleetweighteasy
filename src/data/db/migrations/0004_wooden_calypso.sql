CREATE TABLE `sync_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`pull_cursor` text,
	CONSTRAINT "sync_state_single_row" CHECK("sync_state"."id" = 1)
);
