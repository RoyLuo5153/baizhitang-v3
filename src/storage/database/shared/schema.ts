import { pgTable, serial, timestamp, index, foreignKey, varchar, jsonb, integer, boolean, numeric, text, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const assessments = pgTable("assessments", {
	id: serial().primaryKey().notNull(),
	title: varchar({ length: 200 }).notNull(),
	assessType: varchar("assess_type", { length: 30 }).notNull(),
	createdBy: varchar("created_by", { length: 36 }).notNull(),
	questionIds: jsonb("question_ids"),
	randomConfig: jsonb("random_config"),
	dueDate: timestamp("due_date", { withTimezone: true, mode: 'string' }),
	passingScore: integer("passing_score").default(60),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("assess_created_by_idx").using("btree", table.createdBy.asc().nullsLast().op("text_ops")),
	index("assess_type_idx").using("btree", table.assessType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "assessments_created_by_users_id_fk"
		}),
]);

export const assessmentTargets = pgTable("assessment_targets", {
	id: serial().primaryKey().notNull(),
	assessmentId: integer("assessment_id").notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	score: integer(),
	passed: boolean(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("at_assessment_id_idx").using("btree", table.assessmentId.asc().nullsLast().op("int4_ops")),
	index("at_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.assessmentId],
			foreignColumns: [assessments.id],
			name: "assessment_targets_assessment_id_assessments_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "assessment_targets_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const businessData = pgTable("business_data", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	periodType: varchar("period_type", { length: 10 }).notNull(),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { withTimezone: true, mode: 'string' }).notNull(),
	wechatAddRate: numeric("wechat_add_rate", { precision: 5, scale:  2 }),
	consultationRate: numeric("consultation_rate", { precision: 5, scale:  2 }),
	receptionRate: numeric("reception_rate", { precision: 5, scale:  2 }),
	deliveryRate: numeric("delivery_rate", { precision: 5, scale:  2 }),
	medicationRate: numeric("medication_rate", { precision: 5, scale:  2 }),
	appointmentRate: numeric("appointment_rate", { precision: 5, scale:  2 }),
	dataSource: varchar("data_source", { length: 20 }).default('manual'),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("bd_period_start_idx").using("btree", table.periodStart.asc().nullsLast().op("timestamptz_ops")),
	index("bd_period_type_idx").using("btree", table.periodType.asc().nullsLast().op("text_ops")),
	index("bd_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "business_data_user_id_users_id_fk"
		}),
]);

export const empowerExecutions = pgTable("empower_executions", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	planId: integer("plan_id").notNull(),
	triggeredBy: varchar("triggered_by", { length: 50 }),
	triggerValue: numeric("trigger_value", { precision: 5, scale:  2 }),
	status: varchar({ length: 20 }).default('in_progress').notNull(),
	progress: integer().default(0),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	beforeQuadrant: varchar("before_quadrant", { length: 2 }),
	afterQuadrant: varchar("after_quadrant", { length: 2 }),
	improvementPct: numeric("improvement_pct", { precision: 5, scale:  2 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("ee_plan_id_idx").using("btree", table.planId.asc().nullsLast().op("int4_ops")),
	index("ee_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("ee_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "empower_executions_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [empowerPlans.id],
			name: "empower_executions_plan_id_empower_plans_id_fk"
		}),
]);

export const qcRecords = pgTable("qc_records", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	qcType: varchar("qc_type", { length: 20 }).notNull(),
	reviewerId: varchar("reviewer_id", { length: 36 }),
	scoreBusiness: integer("score_business"),
	scoreService: integer("score_service"),
	scoreCommunication: integer("score_communication"),
	scoreProcess: integer("score_process"),
	aiScore: integer("ai_score"),
	humanScore: integer("human_score"),
	wechatNode: varchar("wechat_node", { length: 50 }),
	wechatActions: jsonb("wechat_actions"),
	audioUrl: text("audio_url"),
	screenshots: jsonb(),
	aiTranscript: text("ai_transcript"),
	aiAnalysis: jsonb("ai_analysis"),
	humanComment: text("human_comment"),
	status: varchar({ length: 20 }).default('pending').notNull(),
	qcDate: timestamp("qc_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("qcr_date_idx").using("btree", table.qcDate.asc().nullsLast().op("timestamptz_ops")),
	index("qcr_reviewer_id_idx").using("btree", table.reviewerId.asc().nullsLast().op("text_ops")),
	index("qcr_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("qcr_type_idx").using("btree", table.qcType.asc().nullsLast().op("text_ops")),
	index("qcr_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "qc_records_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.reviewerId],
			foreignColumns: [users.id],
			name: "qc_records_reviewer_id_users_id_fk"
		}),
]);

export const quadrantSnapshots = pgTable("quadrant_snapshots", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	periodType: varchar("period_type", { length: 10 }).notNull(),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { withTimezone: true, mode: 'string' }).notNull(),
	quadrant: varchar({ length: 2 }).notNull(),
	processItems: jsonb("process_items"),
	resultItems: jsonb("result_items"),
	processPassCount: integer("process_pass_count").default(0),
	processTotalCount: integer("process_total_count").default(0),
	resultPassCount: integer("result_pass_count").default(0),
	resultTotalCount: integer("result_total_count").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("qs_period_start_idx").using("btree", table.periodStart.asc().nullsLast().op("timestamptz_ops")),
	index("qs_quadrant_idx").using("btree", table.quadrant.asc().nullsLast().op("text_ops")),
	index("qs_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "quadrant_snapshots_user_id_users_id_fk"
		}),
]);

export const permissions = pgTable("permissions", {
	id: serial().primaryKey().notNull(),
	code: varchar({ length: 100 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	module: varchar({ length: 50 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("permissions_code_unique").on(table.code),
]);

export const empowerPlans = pgTable("empower_plans", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	indicatorKey: varchar("indicator_key", { length: 50 }).notNull(),
	description: text(),
	content: jsonb(),
	estimatedHours: integer("estimated_hours"),
	targetIndicators: jsonb("target_indicators"),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("ep_indicator_key_idx").using("btree", table.indicatorKey.asc().nullsLast().op("text_ops")),
]);

export const levelProgress = pgTable("level_progress", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	levelId: integer("level_id").notNull(),
	status: varchar({ length: 20 }).default('locked').notNull(),
	bestScore: integer("best_score").default(0),
	attempts: integer().default(0),
	lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true, mode: 'string' }),
	passedAt: timestamp("passed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("lp_level_id_idx").using("btree", table.levelId.asc().nullsLast().op("int4_ops")),
	index("lp_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("lp_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "level_progress_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const resourceViews = pgTable("resource_views", {
	id: serial().primaryKey().notNull(),
	resourceId: integer("resource_id").notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	viewedAt: timestamp("viewed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("rv_resource_id_idx").using("btree", table.resourceId.asc().nullsLast().op("int4_ops")),
	index("rv_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.resourceId],
			foreignColumns: [resources.id],
			name: "resource_views_resource_id_resources_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "resource_views_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const resources = pgTable("resources", {
	id: serial().primaryKey().notNull(),
	title: varchar({ length: 200 }).notNull(),
	category: varchar({ length: 50 }).notNull(),
	fileType: varchar("file_type", { length: 20 }).notNull(),
	fileUrl: text("file_url"),
	description: text(),
	uploadedBy: varchar("uploaded_by", { length: 36 }),
	viewCount: integer("view_count").default(0),
	downloadCount: integer("download_count").default(0),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("res_category_idx").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("res_uploaded_by_idx").using("btree", table.uploadedBy.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "resources_uploaded_by_users_id_fk"
		}),
]);

export const stageRules = pgTable("stage_rules", {
	id: serial().primaryKey().notNull(),
	fromStage: integer("from_stage").notNull(),
	toStage: integer("to_stage").notNull(),
	ruleType: varchar("rule_type", { length: 50 }).notNull(),
	ruleConfig: jsonb("rule_config"),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
});

export const roles = pgTable("roles", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 50 }).notNull(),
	displayName: varchar("display_name", { length: 100 }).notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("roles_name_unique").on(table.name),
]);

export const thresholds = pgTable("thresholds", {
	id: serial().primaryKey().notNull(),
	indicatorKey: varchar("indicator_key", { length: 50 }).notNull(),
	indicatorName: varchar("indicator_name", { length: 100 }).notNull(),
	track: varchar({ length: 20 }).notNull(),
	passing: numeric({ precision: 5, scale:  2 }).notNull(),
	good: numeric({ precision: 5, scale:  2 }).notNull(),
	excellent: numeric({ precision: 5, scale:  2 }).notNull(),
	unit: varchar({ length: 10 }).default('percent'),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	unique("thresholds_indicator_key_unique").on(table.indicatorKey),
]);

export const rolePermissions = pgTable("role_permissions", {
	id: serial().primaryKey().notNull(),
	roleId: integer("role_id").notNull(),
	permissionId: integer("permission_id").notNull(),
}, (table) => [
	index("rp_permission_id_idx").using("btree", table.permissionId.asc().nullsLast().op("int4_ops")),
	index("rp_role_id_idx").using("btree", table.roleId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "role_permissions_role_id_roles_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [permissions.id],
			name: "role_permissions_permission_id_permissions_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	username: varchar({ length: 100 }).notNull(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	realName: varchar("real_name", { length: 100 }).notNull(),
	roleId: integer("role_id").notNull(),
	stage: integer().default(1).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	mentorId: varchar("mentor_id", { length: 36 }),
	department: varchar({ length: 100 }),
	joinDate: timestamp("join_date", { withTimezone: true, mode: 'string' }),
	lastLogin: timestamp("last_login", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("users_is_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("users_mentor_id_idx").using("btree", table.mentorId.asc().nullsLast().op("text_ops")),
	index("users_role_id_idx").using("btree", table.roleId.asc().nullsLast().op("int4_ops")),
	index("users_stage_idx").using("btree", table.stage.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "users_role_id_roles_id_fk"
		}),
	unique("users_username_unique").on(table.username),
]);

export const quizAttempts = pgTable("quiz_attempts", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	levelId: integer("level_id").notNull(),
	score: integer().default(0),
	totalQuestions: integer("total_questions").default(0),
	correctCount: integer("correct_count").default(0),
	answers: jsonb(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("qa_level_id_idx").using("btree", table.levelId.asc().nullsLast().op("int4_ops")),
	index("qa_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "quiz_attempts_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const questions = pgTable("questions", {
	id: serial().primaryKey().notNull(),
	levelId: integer("level_id").notNull(),
	questionType: varchar("question_type", { length: 20 }).notNull(),
	difficulty: varchar({ length: 10 }).default('medium').notNull(),
	content: text().notNull(),
	options: jsonb(),
	answer: jsonb(),
	explanation: text(),
	isActive: boolean("is_active").default(true).notNull(),
	module: varchar({ length: 50 }),
	stage: varchar({ length: 20 }).default('foundation'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	createdBy: varchar("created_by", { length: 36 }),
}, (table) => [
	index("questions_difficulty_idx").using("btree", table.difficulty.asc().nullsLast().op("text_ops")),
	index("questions_level_id_idx").using("btree", table.levelId.asc().nullsLast().op("int4_ops")),
	index("questions_type_idx").using("btree", table.questionType.asc().nullsLast().op("text_ops")),
	index("questions_module_idx").using("btree", table.module.asc().nullsLast().op("text_ops")),
	index("questions_stage_idx").using("btree", table.stage.asc().nullsLast().op("text_ops")),
]);

export const assessmentModules = pgTable("assessment_modules", {
	id: serial().primaryKey().notNull(),
	code: varchar({ length: 50 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	stage: varchar({ length: 20 }).notNull(),
	description: text(),
	sortOrder: integer("sort_order").default(0),
	isActive: boolean("is_active").default(true),
	passThreshold: integer("pass_threshold").default(80),
	questionCount: integer("question_count").default(10),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	unique("assessment_modules_code_unique").on(table.code),
]);

export const coreActions = pgTable("core_actions", {
	actionNo: integer("action_no").primaryKey().notNull(),
	actionName: text("action_name").notNull(),
	nodeId: integer("node_id").notNull(),
	timeType: text("time_type").notNull(),
	isV2New: boolean("is_v2_new").default(false).notNull(),
	trustElement: text("trust_element").notNull(),
	weight: numeric("weight", { precision: 3, scale: 1 }).default('1.0').notNull(),
	description: text(),
	purpose: text(),
	keyPoints: text("key_points"),
	scoringCriteria: jsonb("scoring_criteria"),
	executionForms: jsonb("execution_forms"),
}, (table) => [
	index("ca_node_id_idx").using("btree", table.nodeId.asc().nullsLast().op("int4_ops")),
	index("ca_trust_element_idx").using("btree", table.trustElement.asc().nullsLast().op("text_ops")),
	index("ca_is_v2_new_idx").using("btree", table.isV2New.asc().nullsLast().op("bool_ops")),
]);

export const actionScores = pgTable("action_scores", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	recordId: integer("record_id"),
	actionNo: integer("action_no").notNull(),
	score: integer(),
	perspective: varchar({ length: 20 }),
	executed: boolean("executed").default(true),
	executionForm: text("execution_form"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("as_record_id_idx").using("btree", table.recordId.asc().nullsLast().op("int4_ops")),
	index("as_action_no_idx").using("btree", table.actionNo.asc().nullsLast().op("int4_ops")),
	index("as_perspective_idx").using("btree", table.perspective.asc().nullsLast().op("text_ops")),
	foreignKey({
		columns: [table.recordId],
		foreignColumns: [qcRecords.id],
		name: "action_scores_record_id_qc_records_id_fk"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.actionNo],
		foreignColumns: [coreActions.actionNo],
		name: "action_scores_action_no_core_actions_action_no_fk"
	}),
]);

export const specialPatientActions = pgTable("special_patient_actions", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	patientId: varchar("patient_id", { length: 36 }).notNull(),
	originalNodeId: integer("original_node_id"),
	specialType: varchar("special_type", { length: 20 }).notNull(),
	adjustedNodeId: integer("adjusted_node_id"),
	adjustedDate: timestamp("adjusted_date", { withTimezone: true, mode: 'string' }),
	reason: text(),
	resolved: boolean("resolved").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("spa_patient_id_idx").using("btree", table.patientId.asc().nullsLast().op("text_ops")),
	index("spa_special_type_idx").using("btree", table.specialType.asc().nullsLast().op("text_ops")),
	index("spa_resolved_idx").using("btree", table.resolved.asc().nullsLast().op("bool_ops")),
	foreignKey({
		columns: [table.patientId],
		foreignColumns: [users.id],
		name: "special_patient_actions_patient_id_users_id_fk"
	}).onDelete("cascade"),
]);

export const serviceNodes = pgTable("service_nodes", {
	id: serial().primaryKey().notNull(),
	nodeName: text("node_name").notNull(),
	timeType: text("time_type").notNull(),
	weight: numeric("weight", { precision: 3, scale: 2 }).notNull(),
	trustFocus: text("trust_focus"),
	description: text(),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const trustSnapshots = pgTable("trust_snapshots", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	recordId: integer("record_id"),
	userId: varchar("user_id", { length: 36 }).notNull(),
	nodeId: integer("node_id"),
	cognitiveScore: numeric("cognitive_score", { precision: 5, scale: 2 }),
	professionalScore: numeric("professional_score", { precision: 5, scale: 2 }),
	safetyScore: numeric("safety_score", { precision: 5, scale: 2 }),
	obstacleClearanceScore: numeric("obstacle_clearance_score", { precision: 5, scale: 2 }),
	totalTrust: numeric("total_trust", { precision: 5, scale: 2 }),
	bottleneck: text(),
	suggestion: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ts_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("ts_node_id_idx").using("btree", table.nodeId.asc().nullsLast().op("int4_ops")),
	index("ts_record_id_idx").using("btree", table.recordId.asc().nullsLast().op("int4_ops")),
	foreignKey({
		columns: [table.recordId],
		foreignColumns: [qcRecords.id],
		name: "trust_snapshots_record_id_qc_records_id_fk"
	}),
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "trust_snapshots_user_id_users_id_fk"
	}),
	foreignKey({
		columns: [table.nodeId],
		foreignColumns: [serviceNodes.id],
		name: "trust_snapshots_node_id_service_nodes_id_fk"
	}),
]);

export const moduleProgress = pgTable("module_progress", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	moduleCode: varchar("module_code", { length: 50 }).notNull(),
	status: varchar({ length: 20 }).default('locked'),
	bestScore: integer("best_score").default(0),
	attempts: integer().default(0),
	lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true, mode: 'string' }),
	passedAt: timestamp("passed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("mp_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("mp_module_code_idx").using("btree", table.moduleCode.asc().nullsLast().op("text_ops")),
	index("mp_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "module_progress_user_id_users_id_fk"
	}).onDelete("cascade"),
	unique("module_progress_user_module_unique").on(table.userId, table.moduleCode),
]);
