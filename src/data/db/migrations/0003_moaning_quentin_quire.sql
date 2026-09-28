CREATE TABLE `goal_change_event` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`sex` text NOT NULL,
	`current_weight_kg` real NOT NULL,
	`height_cm` real NOT NULL,
	`target_weight_kg` real,
	`requested_weekly_rate_kg` real,
	`requested_daily_kcal` real
);
--> statement-breakpoint
CREATE INDEX `goal_change_event_at_idx` ON `goal_change_event` (`at`);