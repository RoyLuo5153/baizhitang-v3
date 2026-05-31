import { relations } from "drizzle-orm/relations";
import { users, assessments, assessmentTargets, businessData, empowerExecutions, empowerPlans, qcRecords, quadrantSnapshots, levelProgress, resources, resourceViews, roles, rolePermissions, permissions, quizAttempts } from "./schema";

export const assessmentsRelations = relations(assessments, ({one, many}) => ({
	user: one(users, {
		fields: [assessments.createdBy],
		references: [users.id]
	}),
	assessmentTargets: many(assessmentTargets),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	assessments: many(assessments),
	assessmentTargets: many(assessmentTargets),
	businessData: many(businessData),
	empowerExecutions: many(empowerExecutions),
	qcRecords_userId: many(qcRecords, {
		relationName: "qcRecords_userId_users_id"
	}),
	qcRecords_reviewerId: many(qcRecords, {
		relationName: "qcRecords_reviewerId_users_id"
	}),
	quadrantSnapshots: many(quadrantSnapshots),
	levelProgresses: many(levelProgress),
	resourceViews: many(resourceViews),
	resources: many(resources),
	role: one(roles, {
		fields: [users.roleId],
		references: [roles.id]
	}),
	quizAttempts: many(quizAttempts),
}));

export const assessmentTargetsRelations = relations(assessmentTargets, ({one}) => ({
	assessment: one(assessments, {
		fields: [assessmentTargets.assessmentId],
		references: [assessments.id]
	}),
	user: one(users, {
		fields: [assessmentTargets.userId],
		references: [users.id]
	}),
}));

export const businessDataRelations = relations(businessData, ({one}) => ({
	user: one(users, {
		fields: [businessData.userId],
		references: [users.id]
	}),
}));

export const empowerExecutionsRelations = relations(empowerExecutions, ({one}) => ({
	user: one(users, {
		fields: [empowerExecutions.userId],
		references: [users.id]
	}),
	empowerPlan: one(empowerPlans, {
		fields: [empowerExecutions.planId],
		references: [empowerPlans.id]
	}),
}));

export const empowerPlansRelations = relations(empowerPlans, ({many}) => ({
	empowerExecutions: many(empowerExecutions),
}));

export const qcRecordsRelations = relations(qcRecords, ({one}) => ({
	user_userId: one(users, {
		fields: [qcRecords.userId],
		references: [users.id],
		relationName: "qcRecords_userId_users_id"
	}),
	user_reviewerId: one(users, {
		fields: [qcRecords.reviewerId],
		references: [users.id],
		relationName: "qcRecords_reviewerId_users_id"
	}),
}));

export const quadrantSnapshotsRelations = relations(quadrantSnapshots, ({one}) => ({
	user: one(users, {
		fields: [quadrantSnapshots.userId],
		references: [users.id]
	}),
}));

export const levelProgressRelations = relations(levelProgress, ({one}) => ({
	user: one(users, {
		fields: [levelProgress.userId],
		references: [users.id]
	}),
}));

export const resourceViewsRelations = relations(resourceViews, ({one}) => ({
	resource: one(resources, {
		fields: [resourceViews.resourceId],
		references: [resources.id]
	}),
	user: one(users, {
		fields: [resourceViews.userId],
		references: [users.id]
	}),
}));

export const resourcesRelations = relations(resources, ({one, many}) => ({
	resourceViews: many(resourceViews),
	user: one(users, {
		fields: [resources.uploadedBy],
		references: [users.id]
	}),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({one}) => ({
	role: one(roles, {
		fields: [rolePermissions.roleId],
		references: [roles.id]
	}),
	permission: one(permissions, {
		fields: [rolePermissions.permissionId],
		references: [permissions.id]
	}),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	rolePermissions: many(rolePermissions),
	users: many(users),
}));

export const permissionsRelations = relations(permissions, ({many}) => ({
	rolePermissions: many(rolePermissions),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({one}) => ({
	user: one(users, {
		fields: [quizAttempts.userId],
		references: [users.id]
	}),
}));