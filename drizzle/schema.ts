import { pgTable, index, pgPolicy, uuid, varchar, text, timestamp, foreignKey, integer, numeric } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



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
}, (table) => {
	return {
		idxDocumentItemsDocumentId: index("idx_document_items_document_id").using("btree", table.documentId.asc().nullsLast().op("uuid_ops")),
		documentItemsDocumentIdFkey: foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_items_document_id_fkey"
		}).onDelete("cascade"),
		allowAllForService: pgPolicy("Allow all for service", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
	}
});

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
