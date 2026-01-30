import { Vault } from "obsidian";
import { ReviewHistoryStoreData } from "src/data-stores/review-history-types";

/**
 * Default path for review history file
 */
export const REVIEW_HISTORY_FILE_PATH = ".obsidian/sr-review-history.json";

/**
 * Gets the full path to the review history file
 * @param vault The Obsidian vault instance
 * @returns The full path to the review history file
 */
export function getReviewHistoryFilePath(vault: Vault): string {
    return REVIEW_HISTORY_FILE_PATH;
}

/**
 * Creates the default review history store structure
 * @returns A new ReviewHistoryStoreData with default values
 */
export function createDefaultReviewHistoryStore(): ReviewHistoryStoreData {
    return {
        version: "1.0",
        cards: {},
        metadata: {
            lastUpdated: new Date().toISOString(),
        },
    };
}

/**
 * Validates that a ReviewHistoryStoreData object has the correct structure
 * @param data The data to validate
 * @returns true if valid, false otherwise
 */
export function validateReviewHistoryStore(data: any): data is ReviewHistoryStoreData {
    if (!data || typeof data !== "object") {
        return false;
    }
    if (typeof data.version !== "string") {
        return false;
    }
    if (!data.cards || typeof data.cards !== "object") {
        return false;
    }
    if (!data.metadata || typeof data.metadata !== "object") {
        return false;
    }
    if (typeof data.metadata.lastUpdated !== "string") {
        return false;
    }
    return true;
}
