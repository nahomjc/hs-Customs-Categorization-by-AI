import { pgTable, index, foreignKey, pgPolicy, uuid, varchar, text, numeric, timestamp, integer, unique, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const itemClassifications = pgTable("item_classifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	itemId: uuid("item_id").notNull(),
	aiCategory: varchar("ai_category", { length: 100 }),
	aiHsCode: varchar("ai_hs_code", { length: 20 }),
	cleanDescription: text("clean_description"),
	confidence: numeric({ precision: 5, scale:  2 }),
	aiRawResponse: text("ai_raw_response"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => {
	return {
		idxItemClassificationsItemId: index("idx_item_classifications_item_id").using("btree", table.itemId.asc().nullsLast().op("uuid_ops")),
		itemClassificationsItemIdDocumentItemsIdFk: foreignKey({
			columns: [table.itemId],
			foreignColumns: [documentItems.id],
			name: "item_classifications_item_id_document_items_id_fk"
		}).onDelete("cascade"),
		itemClassificationsItemIdFkey: foreignKey({
			columns: [table.itemId],
			foreignColumns: [documentItems.id],
			name: "item_classifications_item_id_fkey"
		}).onDelete("cascade"),
		allowAllForService: pgPolicy("Allow all for service", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
	}
});

export const groupedItems = pgTable("grouped_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid("document_id").notNull(),
	hsCode: varchar("hs_code", { length: 20 }).notNull(),
	category: varchar({ length: 100 }).notNull(),
	finalDescription: text("final_description").notNull(),
	totalQuantity: integer("total_quantity").notNull(),
	unit: varchar({ length: 20 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => {
	return {
		idxGroupedItemsDocumentId: index("idx_grouped_items_document_id").using("btree", table.documentId.asc().nullsLast().op("uuid_ops")),
		groupedItemsDocumentIdDocumentsIdFk: foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "grouped_items_document_id_documents_id_fk"
		}).onDelete("cascade"),
		groupedItemsDocumentIdFkey: foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "grouped_items_document_id_fkey"
		}).onDelete("cascade"),
		allowAllForService: pgPolicy("Allow all for service", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
	}
});

export const hsCodeReference = pgTable("hs_code_reference", {
	hsCode: varchar("hs_code", { length: 20 }).primaryKey().notNull(),
	category: varchar({ length: 100 }),
	description: text(),
});

export const settings = pgTable("settings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 30 }).notNull(),
	userId: uuid("user_id").notNull(),
	preferences: jsonb().default({"emailOnComplete":true,"autoOpenDocument":true,"defaultExportFormat":"xlsx"}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => {
	return {
		idxSettingsTenantId: index("idx_settings_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
		idxSettingsUserId: index("idx_settings_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
		settingsUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "settings_user_id_fkey"
		}).onDelete("cascade"),
		settingsUserIdUnique: unique("settings_user_id_unique").on(table.userId),
		allowAllForService: pgPolicy("Allow all for service", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
	}
});

export const users = pgTable("users", {
	id: uuid().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 30 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	fullName: varchar("full_name", { length: 255 }),
	avatarUrl: text("avatar_url"),
	role: varchar({ length: 30 }).default('user').notNull(),
	status: varchar({ length: 30 }).default('active').notNull(),
	meta: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => {
	return {
		idxUsersEmail: index("idx_users_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
		idxUsersTenantId: index("idx_users_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
		usersIdFkey: foreignKey({
			columns: [table.id],
			foreignColumns: [table.id],
			name: "users_id_fkey"
		}).onDelete("cascade"),
		usersTenantEmailUnique: unique("users_tenant_email_unique").on(table.tenantId, table.email),
		allowAllForService: pgPolicy("Allow all for service", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
	}
});

export const documents = pgTable("documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 30 }).notNull(),
	uploadedBy: varchar("uploaded_by", { length: 100 }).notNull(),
	originalFileUrl: text("original_file_url").notNull(),
	originalFileName: varchar("original_file_name", { length: 255 }),
	fileType: varchar("file_type", { length: 20 }).notNull(),
	extractedText: text("extracted_text"),
	status: varchar({ length: 30 }).default('uploaded'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	classificationMode: varchar("classification_mode", { length: 30 }).default('ai'),
}, (table) => {
	return {
		idxDocumentsCreatedAt: index("idx_documents_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
		idxDocumentsStatus: index("idx_documents_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
		allowAllForService: pgPolicy("Allow all for service", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
	}
});

export const documentItems = pgTable("document_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid("document_id").notNull(),
	rawLine: text("raw_line").notNull(),
	detectedDescription: text("detected_description"),
	detectedQuantity: integer("detected_quantity"),
	detectedUnit: text("detected_unit"),
	lineIndex: integer("line_index"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	sourceHsCode: varchar("source_hs_code", { length: 20 }),
	lineNumber: integer("line_number"),
	specification: text(),
}, (table) => {
	return {
		idxDocumentItemsDocumentId: index("idx_document_items_document_id").using("btree", table.documentId.asc().nullsLast().op("uuid_ops")),
		documentItemsDocumentIdDocumentsIdFk: foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_items_document_id_documents_id_fk"
		}).onDelete("cascade"),
		documentItemsDocumentIdFkey: foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_items_document_id_fkey"
		}).onDelete("cascade"),
		allowAllForService: pgPolicy("Allow all for service", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
	}
});
