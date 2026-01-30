/**
 * Represents a single review event for a card
 */
export interface ReviewHistoryEntry {
    /** ISO date string (YYYY-MM-DD) */
    date: string;
    /** User's response to the review */
    response: "easy" | "good" | "hard" | "reset";
    /** Interval in days at time of review (for analysis) */
    interval: number;
    /** Ease factor at time of review (for analysis) */
    ease: number;
}

/**
 * Represents the complete review history for a single card
 */
export interface CardReviewHistory {
    /** List of all review events for this card */
    history: ReviewHistoryEntry[];
    /** ISO date of first review */
    created: string;
    /** ISO date of most recent review */
    lastReviewed: string;
}

/**
 * Complete review history store structure
 */
export interface ReviewHistoryStoreData {
    /** Format version: "1.0" */
    version: string;
    /** Map of card ID to review history */
    cards: {
        [cardId: string]: CardReviewHistory;
    };
    /** Metadata about the store */
    metadata: {
        /** ISO datetime of last update */
        lastUpdated: string;
    };
}
