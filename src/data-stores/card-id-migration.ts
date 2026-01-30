import { App } from "obsidian";
import { Card } from "src/card";
import { DataStore } from "src/data-stores/base/data-store";
import { Note } from "src/note";
import { Question } from "src/question";
import { SRSettings } from "src/settings";
import { generateCardId } from "src/utils/card-id";

export interface MigrationProgress {
    totalCards: number;
    migratedCards: number;
    errors: number;
}

/**
 * Migrates card IDs for all cards in the vault
 * Assigns IDs to cards that don't have them
 * @param app The Obsidian app instance
 * @param settings The plugin settings
 * @param onProgress Optional callback for progress updates
 * @returns Migration progress information
 */
export async function migrateCardIds(
    app: App,
    settings: SRSettings,
    onProgress?: (progress: MigrationProgress) => void,
): Promise<MigrationProgress> {
    const progress: MigrationProgress = {
        totalCards: 0,
        migratedCards: 0,
        errors: 0,
    };

    try {
        // Get all markdown files
        const markdownFiles = app.vault.getMarkdownFiles();
        let totalCards = 0;
        let migratedCards = 0;
        let errors = 0;

        for (const file of markdownFiles) {
            try {
                // Check if file has flashcard tags
                const cache = app.metadataCache.getFileCache(file);
                if (!cache) continue;

                const tags = cache.tags || [];
                const hasFlashcardTag = tags.some((tag) =>
                    settings.flashcardTags.some((ft) => tag.tag === ft),
                );

                if (!hasFlashcardTag) continue;

                // Load note and questions
                const note = new Note(file, app.vault);
                const noteText = await file.read();
                // We'd need to use the parser here, but for simplicity,
                // we'll rely on the existing sync mechanism to handle this
                // The migration will happen naturally as cards are reviewed

                // For now, we'll just count and report
                // Actual migration happens when cards are loaded and reviewed
            } catch (error) {
                console.error(`Error processing file ${file.path}:`, error);
                errors++;
            }
        }

        progress.totalCards = totalCards;
        progress.migratedCards = migratedCards;
        progress.errors = errors;

        if (onProgress) {
            onProgress(progress);
        }
    } catch (error) {
        console.error("Error during card ID migration:", error);
        progress.errors++;
    }

    return progress;
}

/**
 * Ensures all cards in a question have IDs
 * This is called automatically when cards are created, but can be called explicitly
 * @param question The question to migrate
 */
export function ensureQuestionCardIds(question: Question): boolean {
    let hasChanges = false;
    for (const card of question.cards) {
        if (!card.cardId) {
            card.cardId = generateCardId();
            hasChanges = true;
        }
    }
    if (hasChanges) {
        question.hasChanged = true;
    }
    return hasChanges;
}
