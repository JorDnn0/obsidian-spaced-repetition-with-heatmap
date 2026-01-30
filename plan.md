# Implementation Plan: Card Review History Storage

## Executive Summary

This plan outlines the implementation of a review history system for flashcards in the Obsidian Spaced Repetition plugin. The system will track every review event (date + response: Easy/Good/Hard) for each card, requiring the introduction of persistent card IDs and a dedicated history storage file within the Obsidian vault.

## Current System Analysis

### Current Storage Mechanism

1. **Card Scheduling Info**: Stored as HTML comments in markdown files
   - Format: `<!--SR:!2023-10-16,34,290-->`
   - Contains: due date, interval, ease factor
   - Location: Inline with the card text in the note file

2. **Card Identification**: 
   - Cards are currently identified by `textHash` (hash of topic path + question text)
   - `textHash` is calculated using `cyrb53()` function
   - Stored in `QuestionText.textHash`
   - Used for postponement list tracking

3. **Review Process Flow**:
   - User reviews card → `FlashcardReviewSequencer.processReview()` called
   - New schedule calculated → `Card.scheduleInfo` updated
   - File written back → `DataStore.questionWriteSchedule()` updates HTML comment
   - **No history is currently stored**

4. **Data Store Architecture**:
   - `IDataStore` interface: `StoreInNotes` implementation
   - `IDataStoreAlgorithm` interface: `DataStoreInNoteAlgorithmOsr` implementation
   - Singleton pattern: `DataStore.getInstance()`, `DataStoreAlgorithm.getInstance()`

### Key Files Involved

- `src/card.ts`: Card model (extends `RepetitionItem`)
- `src/question.ts`: Question model (contains cards, has `textHash`)
- `src/data-stores/notes/notes.ts`: `StoreInNotes` implementation
- `src/data-store-algorithm/data-store-in-note-algorithm-osr.ts`: Schedule formatting
- `src/flashcard-review-sequencer.ts`: Review processing
- `src/question-postponement-list.ts`: Uses `textHash` for postponement tracking

## Design Decisions

### 1. Card ID System

**Requirement**: Persistent, unique identifiers for cards that survive:
- Card text modifications (minor edits)
- File moves/renames
- Note reorganization

**Proposed Solution**: 
- **UUID-based IDs**: Use `short-uuid` library (already in dependencies) to generate UUIDs
- **Format**: Short UUID (e.g., `mhvXdrZT4jP5T8vBxuvm75`)
- **Storage**: Embed in HTML comment alongside schedule info
- **Format**: `<!--SR:!2023-10-16,34,290:card-id:mhvXdrZT4jP5T8vBxuvm75-->`

**Alternative Considered**: 
- Hash-based IDs (like current `textHash`): Rejected because they change when card text changes
- Sequential IDs: Rejected because they require global state management

**ID Assignment Strategy**:
- **New Cards**: Generate UUID when first reviewed
- **Existing Cards**: 
  - If no ID present, generate one on first review after upgrade
  - Migration: Can optionally generate IDs for all existing cards during sync

### 2. History Storage Format

**Location**: Dedicated file in Obsidian vault root: `.obsidian/sr-review-history.json`

**Rationale**:
- Centralized storage (easier to backup/export)
- JSON format (human-readable, easy to parse)
- Hidden file (doesn't clutter vault)
- Plugin-specific location (standard Obsidian plugin data location)

**Alternative Considered**:
- Per-note history files: Rejected (too many files, harder to manage)
- YAML format: Considered but JSON is simpler for programmatic access
- Database: Overkill for this use case

**Data Structure**:
```json
{
  "version": "1.0",
  "cards": {
    "mhvXdrZT4jP5T8vBxuvm75": {
      "history": [
        {
          "date": "2024-01-15",
          "response": "good",
          "interval": 1,
          "ease": 250
        },
        {
          "date": "2024-01-20",
          "response": "easy",
          "interval": 5,
          "ease": 260
        }
      ],
      "created": "2024-01-15",
      "lastReviewed": "2024-01-20"
    }
  },
  "metadata": {
    "lastUpdated": "2024-01-20T10:30:00Z"
  }
}
```

**Fields**:
- `date`: ISO date string (YYYY-MM-DD)
- `response`: "easy" | "good" | "hard" | "reset"
- `interval`: Interval in days at time of review (for analysis)
- `ease`: Ease factor at time of review (for analysis)
- `created`: First review date
- `lastReviewed`: Most recent review date

### 3. Integration Points

**Review Flow Integration**:
1. `FlashcardReviewSequencer.processReview()` → Record history entry
2. `Card` model → Add `cardId` property
3. `Question` model → Generate/manage card IDs
4. `DataStoreInNoteAlgorithmOsr` → Read/write card IDs in HTML comments

**Storage Integration**:
1. New class: `ReviewHistoryStore` (singleton)
2. Methods:
   - `recordReview(cardId, response, scheduleInfo)`
   - `getHistory(cardId)`
   - `getAllHistory()`
   - `migrateCardIds()` (for existing cards)
3. File I/O: Use Obsidian's `Vault` API for file operations

## Implementation Phases

### Phase 1: Card ID Infrastructure

**Goal**: Add card ID system without breaking existing functionality

**Tasks**:
1. **Extend Card Model** (`src/card.ts`)
   - Add `cardId: string` property
   - Add getter/setter methods
   - Ensure backward compatibility (cardId can be null)

2. **Extend Question Model** (`src/question.ts`)
   - Add method `ensureCardIds()` to generate IDs for cards without them
   - Modify `QuestionText` parsing to extract card IDs from HTML comments
   - Update `formatForNote()` to include card IDs in HTML comments

3. **Update HTML Comment Format** (`src/data-store-algorithm/data-store-in-note-algorithm-osr.ts`)
   - Extend `formatCardSchedule()` to include card ID
   - Format: `!<due-date>,<interval>,<ease>:card-id:<uuid>`
   - Update parsing regex to extract card IDs
   - Handle backward compatibility (cards without IDs)

4. **Update Constants** (`src/constants.ts`)
   - Add regex patterns for card ID extraction
   - Update `MULTI_SCHEDULING_EXTRACTOR` to capture card IDs
   - Add card ID validation regex

5. **ID Generation Utility** (`src/utils/card-id.ts`)
   - Create `generateCardId()` function using `short-uuid`
   - Create `validateCardId()` function
   - Export utilities for ID management

**Testing**:
- Unit tests for ID generation
- Unit tests for ID extraction from HTML comments
- Unit tests for backward compatibility (cards without IDs)
- Integration tests for card ID persistence across file writes

### Phase 2: Review History Storage

**Goal**: Implement history storage system

**Tasks**:
1. **Create ReviewHistoryStore** (`src/data-stores/review-history-store.ts`)
   - Singleton class
   - File path: `.obsidian/sr-review-history.json`
   - Methods:
     - `async initialize()`: Load history file, create if doesn't exist
     - `async recordReview(cardId, response, scheduleInfo)`: Add history entry
     - `getHistory(cardId)`: Get history for specific card
     - `getAllHistory()`: Get all history (for statistics/export)
     - `async save()`: Write to file
     - `async load()`: Read from file
   - Error handling: Handle file I/O errors gracefully
   - Thread safety: Use locks to prevent concurrent writes

2. **Review History Data Models** (`src/data-stores/review-history-types.ts`)
   - `ReviewHistoryEntry` interface
   - `CardReviewHistory` interface
   - `ReviewHistoryStore` interface
   - Type definitions for JSON structure

3. **Integrate with Review Flow** (`src/flashcard-review-sequencer.ts`)
   - In `processReviewReviewMode()`:
     - After schedule update, call `ReviewHistoryStore.recordReview()`
     - Pass: cardId, response, scheduleInfo (for interval/ease)
   - Handle edge cases:
     - Reset response (record as "reset")
     - New cards (generate ID if needed before recording)

4. **File Management** (`src/utils/review-history-file.ts`)
   - File path resolution (use Obsidian vault root)
   - File creation with default structure
   - JSON serialization/deserialization
   - Backup mechanism (optional: create backup before major changes)

**Testing**:
- Unit tests for ReviewHistoryStore
- File I/O tests (create, read, update, error handling)
- Integration tests with review sequencer
- Test concurrent access handling

### Phase 3: Card ID Migration

**Goal**: Assign IDs to existing cards

**Tasks**:
1. **Migration Strategy** (`src/data-stores/card-id-migration.ts`)
   - `migrateCardIds()`: Scan all cards, assign IDs to those without
   - Use `textHash` as fallback identifier during migration
   - Batch processing: Process cards in batches to avoid blocking
   - Progress tracking: Report migration progress

2. **Migration Trigger**
   - Option 1: Automatic on first sync after upgrade
   - Option 2: Manual command: "Assign IDs to all cards"
   - Option 3: Lazy migration (assign ID on first review)

3. **Migration Safety**
   - Backup history file before migration
   - Validate IDs after assignment
   - Rollback mechanism if migration fails

**Testing**:
- Test migration with large vaults
- Test migration with cards that already have IDs
- Test rollback mechanism

### Phase 4: History File Management

**Goal**: Ensure history file is properly managed

**Tasks**:
1. **File Location** (`src/utils/review-history-file.ts`)
   - Use Obsidian's `Vault` API to get vault root
   - Path: `.obsidian/sr-review-history.json`
   - Handle vault initialization (create `.obsidian` directory if needed)

2. **File Format Versioning**
   - Add version field to JSON
   - Migration logic for future format changes
   - Validate file format on load

3. **Performance Optimization**
   - Lazy loading: Load history only when needed
   - Caching: Cache history in memory, write on changes
   - Batch writes: Batch multiple review recordings into single write
   - File size management: Optional cleanup of old entries

4. **Error Recovery**
   - Handle corrupted JSON files
   - Handle missing files (recreate)
   - Handle permission errors
   - Log errors appropriately

**Testing**:
- Test file creation in various scenarios
- Test error recovery
- Test performance with large history files

### Phase 5: Integration & Testing

**Goal**: Full integration and comprehensive testing

**Tasks**:
1. **End-to-End Integration**
   - Test complete review flow with history recording
   - Test card ID persistence across file edits
   - Test history retrieval
   - Test with various card types (basic, reversed, cloze)

2. **Backward Compatibility**
   - Ensure cards without IDs still work
   - Ensure old HTML comment format still parses
   - Ensure migration doesn't break existing functionality

3. **Settings Integration** (`src/settings.ts`)
   - Add setting: "Enable review history" (default: true)
   - Add setting: "History file location" (default: `.obsidian/sr-review-history.json`)
   - Add setting: "Auto-assign IDs to existing cards" (default: false)

4. **UI Integration** (Future Phase)
   - Display review history in card UI (optional)
   - Statistics based on history (optional)
   - Export history feature (optional)

**Testing**:
- Full integration test suite
- Backward compatibility tests
- Performance tests with large vaults
- User acceptance testing

## Data Structures

### Card ID in HTML Comment

**Current Format**:
```
<!--SR:!2023-10-16,34,290-->
```

**New Format** (with card ID):
```
<!--SR:!2023-10-16,34,290:card-id:mhvXdrZT4jP5T8vBxuvm75-->
```

**Multi-Card Format** (for questions with multiple cards):
```
<!--SR:!2023-10-16,34,290:card-id:abc123!2023-10-17,5,250:card-id:def456-->
```

**Parsing Regex**:
```typescript
// Updated MULTI_SCHEDULING_EXTRACTOR
const CARD_SCHEDULE_EXTRACTOR = /!([\d-]+),(\d+),(\d+)(?::card-id:([a-zA-Z0-9_-]+))?/g;
```

### Review History JSON Structure

```typescript
interface ReviewHistoryEntry {
  date: string;           // ISO date: "YYYY-MM-DD"
  response: "easy" | "good" | "hard" | "reset";
  interval: number;       // Interval in days at time of review
  ease: number;           // Ease factor at time of review
}

interface CardReviewHistory {
  history: ReviewHistoryEntry[];
  created: string;        // ISO date of first review
  lastReviewed: string;    // ISO date of most recent review
}

interface ReviewHistoryStore {
  version: string;        // Format version: "1.0"
  cards: {
    [cardId: string]: CardReviewHistory;
  };
  metadata: {
    lastUpdated: string;   // ISO datetime
  };
}
```

## Code Changes Summary

### New Files

1. `src/data-stores/review-history-store.ts` - Main history storage class
2. `src/data-stores/review-history-types.ts` - Type definitions
3. `src/utils/card-id.ts` - Card ID utilities
4. `src/utils/review-history-file.ts` - File management utilities
5. `src/data-stores/card-id-migration.ts` - Migration logic

### Modified Files

1. `src/card.ts` - Add `cardId` property
2. `src/question.ts` - Add ID management methods
3. `src/data-store-algorithm/data-store-in-note-algorithm-osr.ts` - Include card IDs in HTML comments
4. `src/flashcard-review-sequencer.ts` - Record history on review
5. `src/constants.ts` - Add card ID regex patterns
6. `src/settings.ts` - Add history-related settings
7. `src/data-stores/notes/notes.ts` - Extract card IDs when reading schedule info

## Migration Strategy

### For Existing Users

1. **Automatic Migration** (Recommended):
   - On first sync after plugin upgrade, scan all cards
   - Assign IDs to cards without them
   - IDs are generated and embedded in HTML comments on next review
   - History starts recording from upgrade date

2. **Lazy Migration** (Alternative):
   - Assign ID only when card is first reviewed after upgrade
   - No upfront scanning required
   - Simpler but IDs assigned gradually

3. **Manual Migration** (Optional):
   - Provide command: "Assign IDs to all cards"
   - User can trigger when convenient
   - Useful for users who want IDs assigned immediately

### Backward Compatibility

- Cards without IDs continue to work normally
- Old HTML comment format still parses correctly
- History recording only happens for cards with IDs
- No breaking changes to existing functionality

## Testing Strategy

### Unit Tests

1. **Card ID Generation**
   - Test UUID generation
   - Test ID validation
   - Test ID extraction from HTML comments

2. **Review History Store**
   - Test recording reviews
   - Test retrieving history
   - Test file I/O operations
   - Test error handling

3. **HTML Comment Parsing**
   - Test parsing with IDs
   - Test parsing without IDs (backward compatibility)
   - Test multi-card format

### Integration Tests

1. **Review Flow**
   - Test complete review → history recording flow
   - Test with various response types
   - Test with new vs. existing cards

2. **File Persistence**
   - Test history persists across plugin restarts
   - Test history survives file edits
   - Test concurrent access handling

3. **Migration**
   - Test ID assignment for existing cards
   - Test migration with large vaults
   - Test rollback on failure

### Performance Tests

1. **Large Vaults**
   - Test with 1000+ cards
   - Test with 10000+ history entries
   - Measure file I/O performance

2. **Concurrent Access**
   - Test multiple reviews happening simultaneously
   - Test file locking mechanism

## Future Enhancements

### Phase 6 (Optional): History Analytics

1. **Statistics Dashboard**
   - Review streak tracking
   - Success rate over time
   - Response distribution (easy/good/hard)
   - Interval progression graphs

2. **Export Features**
   - Export history to CSV/JSON
   - Export for analysis in external tools
   - Backup/restore history

3. **History Visualization**
   - Heatmap of review activity
   - Timeline view of card reviews
   - Performance trends

### Phase 7 (Optional): Advanced Features

1. **History-Based Algorithm Improvements**
   - Use history to improve scheduling
   - Detect patterns in review performance
   - Adaptive difficulty adjustment

2. **Note Review History**
   - Extend history system to notes (not just cards)
   - Unified history for cards and notes

3. **History Pruning**
   - Optional: Remove old history entries
   - Configurable retention period
   - Archive old history

## Risk Assessment

### Technical Risks

1. **File I/O Performance**: Large history files may slow down reviews
   - **Mitigation**: Implement caching and batch writes
   - **Mitigation**: Optional history pruning

2. **Concurrent Access**: Multiple reviews happening simultaneously
   - **Mitigation**: Implement file locking mechanism
   - **Mitigation**: Queue writes if needed

3. **Data Corruption**: JSON file corruption
   - **Mitigation**: Validate JSON on load
   - **Mitigation**: Backup before writes
   - **Mitigation**: Recovery mechanism

4. **Migration Complexity**: Assigning IDs to existing cards
   - **Mitigation**: Lazy migration (assign on first review)
   - **Mitigation**: Thorough testing with various vault sizes

### User Experience Risks

1. **Breaking Changes**: Existing cards stop working
   - **Mitigation**: Full backward compatibility
   - **Mitigation**: Cards without IDs still function

2. **Performance Impact**: Reviews become slower
   - **Mitigation**: Async file writes
   - **Mitigation**: Caching strategy
   - **Mitigation**: Optional feature (can be disabled)

3. **Data Loss**: History file lost or corrupted
   - **Mitigation**: Regular backups
   - **Mitigation**: Recovery mechanisms
   - **Mitigation**: Export feature for user backups

## Success Criteria

1. ✅ Cards can be uniquely identified via persistent IDs
2. ✅ Review history is recorded for every review (Easy/Good/Hard)
3. ✅ History is stored in a dedicated file within the vault
4. ✅ History persists across plugin restarts and file edits
5. ✅ No breaking changes to existing functionality
6. ✅ Backward compatibility maintained (cards without IDs still work)
7. ✅ Performance impact is minimal (< 50ms per review)
8. ✅ Comprehensive test coverage (> 80%)

## Timeline Estimate

- **Phase 1** (Card ID Infrastructure): 2-3 days
- **Phase 2** (Review History Storage): 3-4 days
- **Phase 3** (Card ID Migration): 1-2 days
- **Phase 4** (History File Management): 2-3 days
- **Phase 5** (Integration & Testing): 3-4 days

**Total**: ~11-16 days of development time

## Dependencies

### Existing Dependencies (Already in package.json)
- `short-uuid`: For UUID generation ✅
- `moment`: For date handling ✅
- Obsidian API: For file operations ✅

### No New Dependencies Required

## Conclusion

This plan provides a comprehensive roadmap for implementing review history storage in the Obsidian Spaced Repetition plugin. The design prioritizes:

1. **Backward Compatibility**: Existing functionality remains intact
2. **Performance**: Minimal impact on review speed
3. **Reliability**: Robust error handling and data persistence
4. **Extensibility**: Foundation for future analytics features

The phased approach allows for incremental development and testing, reducing risk and enabling early feedback. The use of persistent card IDs ensures history can be tracked even as cards evolve, and the centralized storage file simplifies backup and export operations.
