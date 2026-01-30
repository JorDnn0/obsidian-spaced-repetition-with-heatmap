# Research: Obsidian Spaced Repetition Plugin

## Executive Summary

This is an **Obsidian plugin** that implements spaced repetition for both **flashcards** and **entire notes**. The plugin uses a custom algorithm called **OSR (Obsidian Spaced Repetition)** which is based on SM-2 but enhanced with note linking and PageRank algorithms to determine review scheduling.

**Version:** 1.13.4  
**Language:** TypeScript  
**Build System:** esbuild  
**Testing:** Jest  
**Package Manager:** pnpm 9.10.0+

---

## Project Overview

### Purpose
The plugin enables users to:
1. Create and review flashcards directly within Obsidian markdown notes
2. Review entire notes using spaced repetition
3. Organize flashcards into hierarchical decks using tags or folder structure
4. Track review statistics and due dates

### Key Features
- **Flashcard Types:**
  - Single-line basic (`Question::Answer`)
  - Single-line reversed (`Question:::Answer`)
  - Multi-line basic (separated by `?`)
  - Multi-line reversed (separated by `??`)
  - Cloze deletion cards (using `==highlight==`, `**bold**`, `{{curly braces}}`, or custom patterns)

- **Note Review:**
  - Tag notes with review tags (default: `#review`)
  - Review entire notes with Easy/Good/Hard responses
  - Automatic scheduling based on note links and importance

- **Organization:**
  - Hierarchical deck structure via tags or folders
  - Card context (automatic titles based on headings)
  - Rich text support (images, LaTeX, code, footnotes)

---

## Architecture Overview

### Core Components

#### 1. **Main Plugin Entry Point** (`src/main.ts`)
- `SRPlugin` class extends Obsidian's `Plugin`
- Handles plugin lifecycle (onload/onunload)
- Manages UI components (sidebar, modals, status bar, ribbon icon)
- Coordinates sync operations
- Registers commands and file menu handlers

#### 2. **Core Logic** (`src/core.ts`)
- `OsrCore`: Base class for core functionality
- `OsrAppCore`: App-specific implementation
- Responsibilities:
  - Loading vault files
  - Processing notes and flashcards
  - Building deck tree structure
  - Managing note review queue
  - Calculating statistics and histograms

#### 3. **Data Models**

**Deck Structure** (`src/deck.ts`):
- Hierarchical tree structure
- Each deck contains:
  - `newFlashcards`: Cards not yet reviewed
  - `dueFlashcards`: Cards due for review
  - `subdecks`: Child decks
- Supports filtering (reviewable, remaining cards)

**Card** (`src/card.ts`):
- Extends `RepetitionItem`
- Contains front/back text
- Links to parent `Question`
- Has scheduling information

**Question** (`src/question.ts`):
- Represents a flashcard question in a note
- Can generate multiple cards (e.g., reversed cards)
- Contains:
  - `QuestionText`: Parsed question text with topic path, block ID
  - `topicPathList`: Deck organization
  - `cards`: Generated card instances
  - `hasEditLaterTag`: Flag for postponement

**Note** (`src/note.ts`):
- Represents a markdown file
- Contains list of `Question` objects
- Can append cards to deck structure
- Handles writing changes back to file

#### 4. **Algorithms**

**SRS Algorithm** (`src/algorithms/base/srs-algorithm.ts`):
- Singleton pattern for algorithm instance
- Interface: `ISrsAlgorithm`

**OSR Algorithm** (`src/algorithms/osr/srs-algorithm-osr.ts`):
- Implements `ISrsAlgorithm`
- Features:
  - Initial interval: 1 day
  - Base ease: 250 (configurable)
  - Link factor: Considers note connections via PageRank
  - Flashcard ease integration: Uses average ease of flashcards in note
  - Load balancing: Distributes reviews using due date histogram

**Note Scheduling** (`src/algorithms/osr/note-scheduling.ts`):
- `osrSchedule()` function calculates new intervals and ease
- Considers:
  - Review response (Easy/Good/Hard)
  - Previous interval
  - Current ease factor
  - Due date histogram for load balancing

**Note Graph** (`src/algorithms/osr/osr-note-graph.ts`):
- Builds graph of note links
- Calculates PageRank for note importance
- Used to determine initial ease for notes

#### 5. **Data Storage**

**Data Store Interface** (`src/data-stores/base/data-store.ts`):
- `IDataStore` interface for storage abstraction
- Currently only one implementation: `StoreInNotes`

**Store in Notes** (`src/data-stores/notes/notes.ts`):
- Stores scheduling info directly in markdown files
- Format: HTML comments `<!--SR:!2023-10-16,34,290-->`
  - Format: `<!--SR:!<due-date>,<interval>,<ease>-->`
- Also supports multi-card format: `!<due-date>,<interval>,<ease>`
- Reads/writes schedule info from note frontmatter or inline comments

**Data Store Algorithm** (`src/data-store-algorithm/`):
- `DataStoreAlgorithm`: Singleton for storage operations
- `DataStoreInNoteAlgorithmOsr`: OSR-specific implementation
- Handles reading/writing schedule info for both cards and notes

#### 6. **Parsing System**

**Parser** (`src/parser.ts`):
- Parses markdown text to extract flashcards
- Supports multiple card formats:
  - Inline separators (single-line cards)
  - Multi-line separators
  - Cloze deletion patterns (via `clozecraft` library)
- Handles code blocks, HTML comments
- Tracks line numbers for question location

**Note Parser** (`src/note-parser.ts`):
- Coordinates parsing of note files
- Extracts frontmatter
- Delegates to main parser

**Question Parser** (`src/note-question-parser.ts`):
- Processes parsed questions
- Creates `Question` and `Card` objects
- Handles topic paths, scheduling info extraction
- Generates multiple cards for reversed formats

#### 7. **Review System**

**Flashcard Review Sequencer** (`src/flashcard-review-sequencer.ts`):
- Manages review session flow
- Implements `IFlashcardReviewSequencer`
- Handles:
  - Card iteration order
  - Review responses
  - Card scheduling updates
  - Postponement list management

**Note Review Queue** (`src/note-review-queue.ts`):
- Manages notes scheduled for review
- Organized by review tags (decks)
- Tracks:
  - New notes (not yet reviewed)
  - Scheduled notes (with due dates)
  - Due notes count

**Next Note Review Handler** (`src/next-note-review-handler.ts`):
- Handles opening next note for review
- Supports random or sequential selection
- Auto-advance option

#### 8. **User Interface**

**GUI Components** (`src/gui/`):
- `sidebar.tsx`: Main sidebar view
- `sr-modal.tsx`: Flashcard review modal
- `sr-tab-view.tsx`: Tab-based review view
- `review-queue-list-view.tsx`: Note review queue display
- `card-ui.tsx`: Individual card display component
- `deck-ui.tsx`: Deck tree display
- `statistics.tsx`: Statistics visualization
- `settings.tsx`: Settings UI
- `edit-modal.tsx`: Card editing modal
- `tab-view-manager.tsx`: Manages tab views

**UI Technologies:**
- React (via `h` factory function, JSX)
- Chart.js for statistics
- GridJS for data tables

#### 9. **Utilities**

**Date Utilities** (`src/utils/dates.ts`):
- Date formatting and parsing
- Global date provider for testing

**String Utilities** (`src/utils/strings.ts`):
- Text direction (LTR/RTL)
- String manipulation
- Hash functions (cyrb53)

**File Utilities** (`src/utils/fs.ts`):
- Path matching patterns
- File system operations

**Topic Path** (`src/topic-path.ts`):
- Represents hierarchical deck paths
- Parses from tags or folder structure
- Format: `flashcards/science/biology`

#### 10. **Settings** (`src/settings.ts`)

Comprehensive settings system:
- **Flashcard settings:** Tags, separators, cloze patterns, deck organization
- **Note review settings:** Review tags, ignore folders, auto-advance
- **UI preferences:** Display options, button text, sizes
- **Algorithm settings:** Base ease, intervals, load balancing
- **Storage settings:** Data store type, comment formatting
- **Debug settings:** Parser and scheduling debug messages

---

## Data Flow

### Flashcard Review Flow

1. **Sync Operation:**
   - `SRPlugin.sync()` → `OsrAppCore.loadVault()`
   - Iterates through all markdown files
   - For each file:
     - Checks if it has flashcard tags
     - Loads and parses note
     - Extracts questions and creates cards
     - Adds cards to deck tree
     - Reads existing schedule info

2. **Review Session:**
   - User triggers review (command, ribbon icon, status bar)
   - `FlashcardReviewSequencer` created with deck tree
   - Cards filtered (remaining cards, not postponed)
   - Cards presented via modal or tab view
   - User responds (Easy/Good/Hard)
   - Schedule updated via algorithm
   - Changes written back to note file

3. **Scheduling Update:**
   - `SrsAlgorithmOsr.cardCalcUpdatedSchedule()` called
   - `osrSchedule()` calculates new interval and ease
   - Schedule info formatted as HTML comment
   - Note file updated with new schedule

### Note Review Flow

1. **Note Discovery:**
   - During sync, notes with review tags are identified
   - Note schedule read from frontmatter or file
   - Note added to `NoteReviewQueue` by tag

2. **Note Selection:**
   - User opens note review queue
   - `NextNoteReviewHandler` selects next note
   - Prioritizes due notes over new notes
   - Can use PageRank for importance sorting

3. **Note Review:**
   - User reads note
   - Responds via file menu or queue context menu
   - `OsrAppCore.saveNoteReviewResponse()` called
   - Algorithm calculates new schedule:
     - Considers note links (PageRank)
     - Uses flashcard ease if available
     - Applies load balancing via histogram
   - Schedule written to note frontmatter
   - If enabled, all flashcards in note are buried

---

## Algorithm Details

### OSR Algorithm (Obsidian Spaced Repetition)

**For Flashcards:**
- Initial interval: 1 day
- Base ease: 250 (default, configurable)
- Ease calculation:
  - Starts with base ease or note's average flashcard ease
  - Adjusted based on review responses
- Interval calculation:
  - Based on current interval and ease
  - Load balancing via due date histogram
  - Easy bonus: 1.3x multiplier
  - Lapse handling: interval reduced by 50%

**For Notes:**
- Initial ease calculation:
  - Base ease: 250
  - Link contribution: Based on note's link count and PageRank
  - Formula: `(1 - linkContribution) * baseEase + linkContribution * (linkTotal / linkPGTotal)`
  - Flashcard ease integration: Average of note ease and flashcard ease
- Interval starts at 1 day
- Same adjustment logic as flashcards

**Load Balancing:**
- Uses `DueDateHistogram` to distribute reviews
- Prevents too many cards/notes due on same day
- Adjusts intervals to spread reviews over time

**PageRank Integration:**
- Builds graph of note links
- Calculates PageRank for each note
- More important notes (higher PageRank) get higher initial ease
- Encourages reviewing important/well-connected notes more frequently

---

## File Structure

```
src/
├── main.ts                          # Plugin entry point
├── core.ts                          # Core logic (OsrCore, OsrAppCore)
├── constants.ts                     # Regex patterns, constants
├── settings.ts                      # Settings definitions
├── plugin-data.ts                   # Plugin data structure
│
├── algorithms/
│   ├── base/
│   │   ├── srs-algorithm.ts        # Algorithm singleton
│   │   ├── isrs-algorithm.ts       # Algorithm interface
│   │   ├── repetition-item.ts      # Base class for cards/notes
│   │   └── rep-item-schedule-info.ts # Schedule info interface
│   └── osr/
│       ├── srs-algorithm-osr.ts    # OSR algorithm implementation
│       ├── note-scheduling.ts      # Scheduling calculations
│       ├── osr-note-graph.ts       # Note graph and PageRank
│       └── rep-item-schedule-info-osr.ts # OSR schedule info
│
├── data-stores/
│   ├── base/
│   │   ├── data-store.ts           # Data store interface
│   │   └── rep-item-storage-info.ts
│   └── notes/
│       └── notes.ts                # Store in notes implementation
│
├── data-store-algorithm/
│   ├── data-store-algorithm.ts     # Storage algorithm singleton
│   └── data-store-in-note-algorithm-osr.ts
│
├── deck.ts                          # Deck tree structure
├── card.ts                          # Card model
├── question.ts                      # Question model
├── note.ts                          # Note model
├── topic-path.ts                    # Topic path (deck path) handling
│
├── parser.ts                        # Flashcard parser
├── note-parser.ts                   # Note file parser
├── note-question-parser.ts          # Question extraction
│
├── flashcard-review-sequencer.ts    # Review session management
├── note-review-queue.ts             # Note review queue
├── note-review-deck.ts              # Note review deck structure
├── next-note-review-handler.ts      # Next note selection
│
├── deck-tree-iterator.ts            # Deck tree iteration
├── deck-tree-stats-calculator.ts    # Statistics calculation
├── due-date-histogram.ts            # Due date distribution
├── stats.ts                         # Statistics model
│
├── gui/                             # React UI components
│   ├── sidebar.tsx
│   ├── sr-modal.tsx
│   ├── sr-tab-view.tsx
│   ├── review-queue-list-view.tsx
│   ├── card-ui.tsx
│   ├── deck-ui.tsx
│   ├── statistics.tsx
│   ├── settings.tsx
│   └── ...
│
├── utils/                           # Utility functions
│   ├── dates.ts
│   ├── strings.ts
│   ├── fs.ts
│   ├── numbers.ts
│   ├── types.ts
│   └── ...
│
└── lang/                            # Internationalization
    ├── helpers.ts
    └── locale/                      # Translation files
        ├── en.ts
        ├── zh-cn.ts
        ├── ja.ts
        └── ... (25+ languages)
```

---

## Key Design Patterns

1. **Singleton Pattern:**
   - `SrsAlgorithm.instance`
   - `DataStore.instance`
   - `DataStoreAlgorithm.instance`

2. **Strategy Pattern:**
   - Algorithm implementations (OSR, future: FSRS)
   - Data store implementations (StoreInNotes, future: YAML file)

3. **Factory Pattern:**
   - `Question.Create()` - Creates questions from parsed info
   - `DeckTreeIterator` creation

4. **Observer Pattern:**
   - `onOsrVaultDataChanged()` callback for UI updates
   - Workspace event listeners

5. **Template Method:**
   - `OsrCore` base class with `processFile()`, `finaliseLoad()`

---

## Dependencies

### Production Dependencies
- `chart.js`: Statistics visualization
- `clozecraft`: Cloze deletion parsing
- `gridjs`: Data tables
- `minimatch`: Path pattern matching
- `pagerank.js`: PageRank calculation for note importance
- `short-uuid`: UUID generation

### Development Dependencies
- `esbuild`: Build tool
- `jest`: Testing framework
- `typescript`: Type checking
- `eslint`: Linting
- `prettier`: Code formatting
- `obsidian`: Obsidian API types

---

## Testing

- Test framework: Jest
- Test location: `tests/unit/`
- Test structure mirrors source structure
- Mock Obsidian API in `tests/unit/__mocks__/obsidian.js`
- Sample test vaults in `tests/vaults/`

---

## Internationalization

- Supports 25+ languages
- Translation files in `src/lang/locale/`
- Uses `t()` helper function for translations
- Languages include: English, Chinese (simplified/traditional), Japanese, Korean, Arabic, French, German, Spanish, Portuguese, Russian, Turkish, and more

---

## Storage Format

### Flashcard Schedule Info
Stored as HTML comments in markdown:
```html
<!--SR:!2023-10-16,34,290-->
```
- Format: `<!--SR:!<due-date>,<interval>,<ease>-->`
- Due date: YYYY-MM-DD format
- Interval: Days until next review
- Ease: Current ease factor

### Note Schedule Info
Stored in YAML frontmatter:
```yaml
---
sr-due: 2023-10-16
sr-interval: 34
sr-ease: 290
---
```

### Multi-Card Format
For questions with multiple cards:
```
!2023-10-16,34,290
```
Multiple instances can appear in one comment.

---

## Future Roadmap

According to README, planned features:
1. **FSRS Algorithm:** Free Spaced Repetition Scheduler implementation
2. **YAML Storage:** Store scheduling info in dedicated `.yaml` file
3. **Migration:** Tools to migrate between storage systems
4. **Documentation Updates:** For new features

---

## Key Insights

1. **Hybrid Approach:** The plugin stores scheduling data directly in markdown files, making it portable and version-control friendly.

2. **Note Graph Integration:** Unique feature that uses note linking to determine review priority and initial ease, making well-connected notes more likely to be reviewed.

3. **Flexible Card Formats:** Supports multiple card syntaxes to accommodate different user preferences and workflows.

4. **Load Balancing:** Uses histograms to distribute reviews over time, preventing review overload on specific days.

5. **Extensible Design:** Architecture supports multiple algorithms and storage backends, though currently only OSR and in-note storage are implemented.

6. **Rich Text Support:** Leverages Obsidian's markdown rendering, supporting images, LaTeX, code blocks, and footnotes in flashcards.

---

## Code Quality

- **TypeScript:** Strong typing throughout
- **Modular Design:** Clear separation of concerns
- **Error Handling:** Try-catch blocks, null checks
- **Testing:** Comprehensive unit tests
- **Linting:** ESLint with TypeScript rules
- **Formatting:** Prettier for consistent style
- **Documentation:** Inline comments and JSDoc

---

## Performance Considerations

1. **Sync Lock:** Prevents concurrent sync operations
2. **Metadata Cache:** Uses Obsidian's metadata cache for tags/links (avoids file reads)
3. **Lazy Loading:** Notes only loaded when needed
4. **Batch Operations:** Multiple file writes batched where possible
5. **Histogram Caching:** Due date histograms calculated once per sync

---

## Security & Privacy

- All data stored locally in user's vault
- No external API calls
- No data transmission
- User controls all data

---

## Conclusion

This is a well-architected, feature-rich spaced repetition plugin for Obsidian. The codebase demonstrates:
- Clean separation of concerns
- Extensible design for future algorithms/storage
- Strong TypeScript typing
- Comprehensive feature set
- Good user experience with multiple review modes
- Internationalization support

The OSR algorithm is a unique approach that combines traditional spaced repetition with note graph analysis, making it particularly suited for knowledge management workflows in Obsidian.

