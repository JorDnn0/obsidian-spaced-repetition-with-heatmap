import { RepItemScheduleInfo } from "src/algorithms/base/rep-item-schedule-info";
import { ReviewResponse } from "src/algorithms/base/repetition-item";
import { Vault } from "obsidian";
import {
    CardReviewHistory,
    ReviewHistoryEntry,
    ReviewHistoryStoreData,
} from "src/data-stores/review-history-types";
import { SRSettings } from "src/settings";
import { formatDateYYYYMMDD } from "src/utils/dates";
import {
    createDefaultReviewHistoryStore,
    validateReviewHistoryStore,
} from "src/utils/review-history-file";

/**
 * Singleton class for managing review history storage
 */
export class ReviewHistoryStore {
    private static instance: ReviewHistoryStore;
    private vault: Vault;
    private settings: SRSettings;
    private data: ReviewHistoryStoreData;
    private filePath: string;
    private isInitialized: boolean = false;
    private writeLock: boolean = false;
    private pendingWrites: number = 0;

    private constructor(vault: Vault, settings?: SRSettings) {
        this.vault = vault;
        this.settings = settings;
        this.filePath = settings?.reviewHistoryFilePath || ".obsidian/sr-review-history.json";
        this.data = createDefaultReviewHistoryStore();
    }

    /**
     * Get or create the singleton instance
     */
    public static getInstance(vault?: Vault, settings?: SRSettings): ReviewHistoryStore {
        if (!ReviewHistoryStore.instance) {
            if (!vault) {
                throw new Error("Vault must be provided for first initialization");
            }
            ReviewHistoryStore.instance = new ReviewHistoryStore(vault, settings);
        } else if (settings) {
            // Update settings if provided
            ReviewHistoryStore.instance.settings = settings;
            ReviewHistoryStore.instance.filePath =
                settings.reviewHistoryFilePath || ".obsidian/sr-review-history.json";
        }
        return ReviewHistoryStore.instance;
    }

    /**
     * Initialize the store by loading the history file
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            await this.load();
        } catch (error) {
            console.warn("Failed to load review history, creating new store:", error);
            this.data = createDefaultReviewHistoryStore();
        }

        this.isInitialized = true;
    }

    /**
     * Load review history from file
     */
    private async load(): Promise<void> {
        try {
            const file = this.vault.getAbstractFileByPath(this.filePath);
            if (file && "read" in file) {
                const content = await (file as any).read();
                const parsed = JSON.parse(content);
                if (validateReviewHistoryStore(parsed)) {
                    this.data = parsed;
                } else {
                    throw new Error("Invalid review history file format");
                }
            } else {
                // File doesn't exist, use default
                this.data = createDefaultReviewHistoryStore();
            }
        } catch (error) {
            console.error("Error loading review history:", error);
            throw error;
        }
    }

    /**
     * Save review history to file
     */
    private async save(): Promise<void> {
        // Wait for any pending writes to complete
        while (this.writeLock) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }

        this.writeLock = true;
        this.pendingWrites++;

        try {
            this.data.metadata.lastUpdated = new Date().toISOString();
            const content = JSON.stringify(this.data, null, 2);

            // Ensure .obsidian directory exists
            const adapter = (this.vault as any).adapter;
            const dirPath = ".obsidian";
            try {
                await adapter.mkdir(dirPath);
            } catch (error) {
                // Directory might already exist, ignore
            }

            // Write file
            await adapter.write(this.filePath, content);
        } catch (error) {
            console.error("Error saving review history:", error);
            throw error;
        } finally {
            this.pendingWrites--;
            this.writeLock = false;
        }
    }

    /**
     * Record a review event for a card
     * @param cardId The card ID
     * @param response The user's response
     * @param scheduleInfo The schedule info at time of review
     */
    public async recordReview(
        cardId: string,
        response: ReviewResponse,
        scheduleInfo: RepItemScheduleInfo | null,
    ): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (!cardId) {
            console.warn("Cannot record review: card ID is missing");
            return;
        }

        // Convert ReviewResponse enum to string
        let responseStr: "easy" | "good" | "hard" | "reset";
        switch (response) {
            case ReviewResponse.Easy:
                responseStr = "easy";
                break;
            case ReviewResponse.Good:
                responseStr = "good";
                break;
            case ReviewResponse.Hard:
                responseStr = "hard";
                break;
            case ReviewResponse.Reset:
                responseStr = "reset";
                break;
            default:
                responseStr = "good";
        }

        const today = formatDateYYYYMMDD(new Date());
        const interval = scheduleInfo ? scheduleInfo.interval : 0;
        const ease = scheduleInfo ? scheduleInfo.latestEase : 0;

        const entry: ReviewHistoryEntry = {
            date: today,
            response: responseStr,
            interval: interval,
            ease: ease,
        };

        // Get or create card history
        if (!this.data.cards[cardId]) {
            this.data.cards[cardId] = {
                history: [],
                created: today,
                lastReviewed: today,
            };
        }

        const cardHistory = this.data.cards[cardId];
        cardHistory.history.push(entry);
        cardHistory.lastReviewed = today;

        // Save asynchronously (don't wait)
        this.save().catch((error) => {
            console.error("Failed to save review history:", error);
        });
    }

    /**
     * Get review history for a specific card
     * @param cardId The card ID
     * @returns The card's review history, or null if not found
     */
    public getHistory(cardId: string): CardReviewHistory | null {
        if (!this.isInitialized) {
            return null;
        }
        return this.data.cards[cardId] || null;
    }

    /**
     * Get all review history
     * @returns A copy of all review history data
     */
    public getAllHistory(): ReviewHistoryStoreData {
        if (!this.isInitialized) {
            return createDefaultReviewHistoryStore();
        }
        // Return a deep copy to prevent external modifications
        return JSON.parse(JSON.stringify(this.data));
    }

    /**
     * Wait for all pending writes to complete
     */
    public async flush(): Promise<void> {
        while (this.pendingWrites > 0 || this.writeLock) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    }
}
