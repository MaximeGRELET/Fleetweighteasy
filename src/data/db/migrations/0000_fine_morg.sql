CREATE TABLE `consent` (
	`id` integer PRIMARY KEY NOT NULL,
	`granted_at` text NOT NULL,
	`policy_version` text NOT NULL,
	CONSTRAINT "consent_single_row" CHECK("consent"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `food_item` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`barcode` text,
	`name` text NOT NULL,
	`brand` text,
	`kcal_per_100` real NOT NULL,
	`protein_g_per_100` real NOT NULL,
	`carbs_g_per_100` real NOT NULL,
	`fat_g_per_100` real NOT NULL,
	`fiber_g_per_100` real,
	`sugar_g_per_100` real,
	`saturated_fat_g_per_100` real,
	`sodium_mg_per_100` real,
	`serving_sizes` text NOT NULL,
	`verified` integer NOT NULL,
	`cached_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `food_item_barcode_idx` ON `food_item` (`barcode`);--> statement-breakpoint
CREATE INDEX `food_item_name_idx` ON `food_item` (`name`);--> statement-breakpoint
CREATE TABLE `food_log_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`meal_type` text NOT NULL,
	`food_item_id` text,
	`meal_id` text,
	`quantity_g` real NOT NULL,
	`name_snapshot` text NOT NULL,
	`kcal_snapshot` real NOT NULL,
	`protein_g_snapshot` real NOT NULL,
	`carbs_g_snapshot` real NOT NULL,
	`fat_g_snapshot` real NOT NULL,
	`fiber_g_snapshot` real,
	`logged_at` text NOT NULL,
	FOREIGN KEY (`food_item_id`) REFERENCES `food_item`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`meal_id`) REFERENCES `meal`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "food_log_entry_single_source" CHECK(not ("food_log_entry"."food_item_id" is not null and "food_log_entry"."meal_id" is not null))
);
--> statement-breakpoint
CREATE INDEX `food_log_entry_date_idx` ON `food_log_entry` (`date`);--> statement-breakpoint
CREATE TABLE `meal` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`items` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`sex` text NOT NULL,
	`birth_date` text NOT NULL,
	`height_cm` real NOT NULL,
	`current_weight_kg` real NOT NULL,
	`goal_type` text NOT NULL,
	`target_weight_kg` real,
	`weekly_rate_kg` real,
	`activity_level` text NOT NULL,
	`training_days_per_week` integer NOT NULL,
	`diet_type` text NOT NULL,
	`allergies` text NOT NULL,
	`dislikes` text NOT NULL,
	`calorie_mode` text NOT NULL,
	`onboarding_completed` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "profile_single_row" CHECK("profile"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `sync_meta` (
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`updated_at` text NOT NULL,
	`synced_at` text,
	`dirty` integer NOT NULL,
	`deleted_at` text,
	PRIMARY KEY(`entity_type`, `entity_id`)
);
--> statement-breakpoint
CREATE INDEX `sync_meta_dirty_idx` ON `sync_meta` (`dirty`);--> statement-breakpoint
CREATE TABLE `weight_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`weight_kg` real NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weight_entry_date_unique` ON `weight_entry` (`date`);--> statement-breakpoint
CREATE TABLE `workout_log_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`estimated_kcal_burned` real
);
--> statement-breakpoint
CREATE INDEX `workout_log_entry_date_idx` ON `workout_log_entry` (`date`);