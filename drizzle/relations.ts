import { relations } from "drizzle-orm/relations";
import { documentItems, itemClassifications, documents, groupedItems, usersInAuth, users } from "./schema";

export const itemClassificationsRelations = relations(itemClassifications, ({one}) => ({
	documentItem: one(documentItems, {
		fields: [itemClassifications.itemId],
		references: [documentItems.id]
	}),
}));

export const documentItemsRelations = relations(documentItems, ({one, many}) => ({
	itemClassifications: many(itemClassifications),
	document: one(documents, {
		fields: [documentItems.documentId],
		references: [documents.id]
	}),
}));

export const groupedItemsRelations = relations(groupedItems, ({one}) => ({
	document: one(documents, {
		fields: [groupedItems.documentId],
		references: [documents.id]
	}),
}));

export const documentsRelations = relations(documents, ({many}) => ({
	groupedItems: many(groupedItems),
	documentItems: many(documentItems),
}));

export const usersRelations = relations(users, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [users.id],
		references: [usersInAuth.id]
	}),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	users: many(users),
}));