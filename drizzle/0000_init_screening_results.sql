CREATE TABLE "screening_results" (
	"topic_id" varchar(255) NOT NULL,
	"revision_number" integer NOT NULL,
	"evaluation" jsonb NOT NULL,
	"title" text NOT NULL,
	"near_account" varchar(255) NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"revision_timestamp" timestamp with time zone,
	"quality_score" real,
	"attention_score" real,
	CONSTRAINT "screening_results_topic_id_revision_number_pk" PRIMARY KEY("topic_id","revision_number")
);
--> statement-breakpoint
CREATE INDEX "idx_screening_results_topic_id" ON "screening_results" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_screening_results_near_account" ON "screening_results" USING btree ("near_account");--> statement-breakpoint
CREATE INDEX "idx_screening_results_timestamp" ON "screening_results" USING btree ("timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_screening_results_overall_pass" ON "screening_results" USING btree (((evaluation->>'overallPass')::boolean));--> statement-breakpoint
CREATE INDEX "idx_screening_results_topic_revision" ON "screening_results" USING btree ("topic_id","revision_number" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_screening_results_quality_score" ON "screening_results" USING btree ("quality_score");--> statement-breakpoint
CREATE INDEX "idx_screening_results_attention_score" ON "screening_results" USING btree ("attention_score");--> statement-breakpoint
CREATE INDEX "idx_screening_results_relevant" ON "screening_results" USING btree ((evaluation->'relevant'->>'score'));--> statement-breakpoint
CREATE INDEX "idx_screening_results_material" ON "screening_results" USING btree ((evaluation->'material'->>'score'));