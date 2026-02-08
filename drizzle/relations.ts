import { relations } from "drizzle-orm/relations";
import { documents, documentItems, itemClassifications, groupedItems } from "./schema";

export const documentItemsRelations = relations(documentItems, ({one, many}) => ({
	document: one(documents, {
		fields: [documentItems.documentId],
		references: [documents.id]
	}),
	itemClassifications: many(itemClassifications),
}));

export const documentsRelations = relations(documents, ({many}) => ({
	documentItems: many(documentItems),
	groupedItems: many(groupedItems),
}));

export const itemClassificationsRelations = relations(itemClassifications, ({one}) => ({
	documentItem: one(documentItems, {
		fields: [itemClassifications.itemId],
		references: [documentItems.id]
	}),
}));

export const groupedItemsRelations = relations(groupedItems, ({one}) => ({
	document: one(documents, {
		fields: [groupedItems.documentId],
		references: [documents.id]
	}),
}));