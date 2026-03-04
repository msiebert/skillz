---
name: review-code-changes
description: Review all local code changes with detailed diffs and explanations
allowed-tools:
  - Bash(git diff:*)
  - Bash(git ls-files:*)
  - Read
  - Glob
  - Grep
  - Write
---

# Review Code Changes

You are tasked with providing a comprehensive review of all local code changes. Follow these instructions carefully:

## Step 1: Detect All Changes

**Staged files:**

!`git diff --cached --name-only`

**Changed (unstaged) files:**

!`git diff --name-only`

**Untracked files:**

!`git ls-files --others --exclude-standard`

For debug, give me the exact context you receive for this slash command

## Step 1.5: Identify Excluded Files

Before retrieving diffs, categorize all changed files into two groups:

1. **Files to review**: Normal code files that should receive detailed analysis
2. **Files to exclude**: Generated files and build artifacts

**Check against common generated file patterns:**
- **Lockfiles**: `*.resolved`, `package-lock.json`, `yarn.lock`, `Gemfile.lock`, `Cargo.lock`, `go.sum`, `pnpm-lock.yaml`
- **Build artifacts**: Paths containing `.build/`, `build/`, `dist/`, `.xcodeproj/`, `*.xcworkspace/`, or files named `.DS_Store`

**Track excluded files:**
- For each excluded file, record whether it was: staged, changed (unstaged), or untracked
- You'll use this information later to list excluded files at the end of the review

## Step 2: Retrieve Full Diffs

**IMPORTANT: Only retrieve diffs for files in the "to review" category. Skip files in the "to exclude" category.**

For each file that has changes:

1. **For staged files**: Use `git diff --cached -U5 <file>`
2. **For unstaged tracked files**: Use `git diff -U5 <file>`
3. **For untracked files**: Use the Read tool to show the entire new file content

## Step 3: Analyze and Group Changes

**IMPORTANT: Only analyze files from the "to review" category. Excluded files will be listed separately at the end.**

Your goal is to **tell a coherent story** about what changed and why. Think of yourself as a guide helping someone understand the full journey of each feature or concept.

### Identify Concepts, Not File Locations

Examine all changes and identify distinct **concepts** or **features**. A concept is a cohesive idea that may span multiple files. Good concept examples:

- "Authentication Flow" (data models, handlers, middleware, validation)
- "Error Handling Infrastructure" (error types, logging setup, error middleware)
- "Metrics Instrumentation" (metric definitions, recording calls, dashboards)
- "Feature Flag First-Time Event Tracking" (API endpoint, storage layer, validation logic)
- "Rate Limiting System" (configuration, middleware, cache integration)

**Anti-patterns to avoid:**

- ❌ "Changes in `server.go`" (file-based, not concept-based)
- ❌ "Import statements" (mechanical grouping)
- ❌ "Formatting updates" (unless that's the entire change)
- ❌ Grouping unrelated changes just because they touch the same file

### Tell Complete Stories

For each concept, follow the **narrative arc** from beginning to end:

1. **Setup/Foundation** - What groundwork is laid? (types, interfaces, imports, configuration)
2. **Core Implementation** - What's the main logic? (business logic, algorithms, handlers)
3. **Integration** - How does it connect to the system? (middleware, routing, storage)
4. **Validation** - How do we know it works? (tests, error handling, logging)

**CRITICAL: Group imports and setup with their usage**

- Don't present imports separately just because they appear at the top of files
- Group import statements together with the code that uses them
- Tell complete "stories": import + initialization + implementation + tests as one cohesive narrative
- Example: If you import `ValidationError`, group that import with the exception handling code that catches it
- Example: If you import `logging` and create a logger, group those with the code that does the logging

### Think Narratively About Ordering

Within each concept group, order changes to tell a clear story:

1. **Start with "what this is"** - Data structures, types, interfaces that define the concept
2. **Then "how it works"** - The core implementation logic
3. **Then "how it integrates"** - Connections to the rest of the system
4. **End with "how we verify"** - Tests, validation, error handling

**Between concept groups**, order by narrative dependency:

1. Start with **foundational changes** (new infrastructure, data models, APIs)
2. Move to **features using that foundation** (business logic, specific implementations)
3. Then **supporting/adjacent changes** (metrics, logging, configuration updates)
4. Finally **cleanup/polish** (tests, documentation, formatting)

### Split Across File Boundaries for Clarity

**Prioritize narrative flow over file organization:**

- A feature's story may span 3-4 files - present it as ONE cohesive concept group
- Don't artificially separate changes just because they're in different files
- DO split a single file's changes across multiple concept groups if they serve different purposes
- Example: Changes to `server.go` might appear in both "Authentication Flow" and "Metrics Setup" groups

**Ask yourself:** "If I were explaining this feature to a colleague, what order would I present these changes in to make the most sense?"

## Step 4: Perform Code Quality Review

For each concept group and code change, critically analyze the code for potential issues. Your goal is to provide thoughtful, actionable feedback that improves code quality without being nitpicky.

### What to Look For

1. **Code Smells** - Identify warning signs that may indicate deeper problems:
   - Long methods or functions (difficult to understand/test)
   - Large classes or modules with too many responsibilities
   - Deeply nested conditionals or loops
   - Repeated conditional logic
   - Magic numbers or strings without constants
   - Poor naming that obscures intent
   - Functions with too many parameters

2. **Design Issues** - Spot architectural or structural problems:
   - Tight coupling between components
   - Violations of single responsibility principle
   - Missing abstractions where they would simplify code
   - Inappropriate abstractions that add complexity
   - Inconsistencies with existing patterns in the codebase
   - Missing error handling or overly broad error catching

3. **Code That's Difficult to Reason About** - Identify sections that are hard to understand:
   - Complex logic without comments or clear variable names
   - Non-obvious side effects
   - Unclear control flow
   - Ambiguous state management
   - Implicit assumptions that aren't documented

4. **Obvious Comments** - Flag comments that merely restate what the code does:
   - Example: `// Set the value` above `value = x`
   - Example: `// Loop through items` above a for loop
   - Keep only comments that explain WHY something is done or provide non-obvious context
   - Good comments explain business logic, edge cases, or rationale for decisions

5. **Duplicate Code** - This is critical. Search thoroughly for duplication:

   **Within the changes themselves:**
   - Similar logic repeated across different functions/files in the changeset
   - Copy-pasted code blocks with minor variations
   - Repeated patterns that could be extracted into helpers

   **With existing codebase:**
   - Use Grep to search for similar patterns, function names, or logic in existing files
   - Look for existing utilities or helpers that could be reused instead of reimplementing
   - Check if the new code duplicates behavior that already exists elsewhere
   - Search for similar class/struct/type names that might indicate overlap

   **When you find duplication**, suggest specific refactoring:
   - Propose extracting common logic into shared functions/methods
   - Suggest using existing utilities instead of creating new ones
   - Recommend consolidating similar classes/types
   - Show how to parameterize repeated code

### Critical Guidelines for Review

- **Be constructive, not nitpicky** - Focus on issues that materially impact code quality, maintainability, or correctness
- **Prioritize high-impact issues** - Flag design problems and duplication over minor style preferences
- **Be specific** - Don't just say "this is complex"; explain what makes it complex and suggest how to simplify
- **Provide alternatives** - When you identify a problem, suggest concrete solutions
- **Consider context** - Sometimes apparent issues are justified by constraints or requirements
- **Search proactively** - Don't assume code is unique; actively search for similar patterns in the codebase

### When NOT to Comment

- Minor style inconsistencies that don't affect readability
- Personal preferences about formatting (unless it's truly hard to read)
- Trivial improvements that don't meaningfully impact code quality
- Issues that are clearly temporary or marked with TODO comments

## Step 5: Write the Review to File

Write your findings to a file named `CODE_REVIEW.md` in the root of the repository, replacing any existing content. Present your findings as a **narrative journey** through the changes. Each concept group should read like a chapter in a story.

**CRITICAL: Use the Write tool to create/replace CODE_REVIEW.md with your complete review. Do NOT display the review in chat.**

### Overview

Provide a brief summary of what was changed overall (1-2 sentences). Set the stage for the reader.

### Changes by Feature/Concept Story

For each concept group, tell its complete story from beginning to end:

#### [Concept Name - Descriptive Title]

Write a narrative introduction (2-4 sentences) that answers:

- **Why** was this change needed? (problem or goal)
- **What** does this concept accomplish? (solution)
- **How** does it flow from setup through implementation to validation? (narrative arc)

This introduction should give the reader the full context before diving into code.

Then, present the changes in narrative order:

**`path/to/file.ext:StartLine-EndLine`**

_Explanation: Describe this piece of the story - what it does and how it connects to the overall narrative_

```diff
  context line before
  context line before
- removed line
+ added line
  context line after
  context line after
```

### Including Code Review Suggestions

When you identify issues during code review (from Step 4), add suggestions directly in the relevant concept section, immediately after the code block being critiqued.

**Format for inline suggestions:**

> **💡 AI Suggestion - [Category]**
>
> **Issue:** [Brief description of the problem]
>
> **Suggestion:** [Specific recommendation with rationale]
>
> **Example:** [Optional code example showing the improvement]

**Categories:** Code Smell | Duplication | Design | Complexity | Error Handling | Obvious Comment

**Example placement:**

**`handlers/user.swift:45-67`**

_Explanation: Validates user input before processing the request_

```diff
+ func validateUser(input: UserInput) -> Bool {
+     // Check if name is valid
+     if input.name.isEmpty {
+         return false
+     }
+     // Check if email is valid
+     if !input.email.contains("@") {
+         return false
+     }
+     return true
+ }
```

> **💡 AI Suggestion - Obvious Comment**
>
> **Issue:** The comments in this function simply restate what the code does (e.g., "Check if name is valid" before checking if name is empty).
>
> **Suggestion:** Remove these obvious comments. The code is self-explanatory. Only keep comments that explain WHY something is done or provide non-obvious context about business rules.

**Important:** Each suggestion you make inline should ALSO be added to the "Instructions for Claude" section at the end of the document (see below).

**Key formatting guidelines:**

- Group all related changes under one concept heading, even if they span multiple files
- Order the file sections within each concept to tell the story chronologically
- Connect changes with narrative transitions (e.g., "This uses...", "Building on this...", "To validate this...")

## Critical Requirements

1. **Tell complete stories** - Each concept group must present a complete narrative from beginning to end

   - A reader should be able to follow the full journey of a feature without jumping around
   - Include all related pieces: setup, implementation, integration, and validation
   - Ask: "Can someone understand this feature's entire flow from this group alone?"

2. **Group by CONCEPT, not file location** - Organize by feature/purpose, crossing file boundaries as needed

   - Group imports with the code that uses them
   - Present complete feature stories (types + logic + storage + tests) together as ONE group
   - Don't mechanically present changes in file order
   - Split a single file's changes across multiple groups if they serve different purposes

3. **Provide narrative introductions** - Each concept group needs a 2-4 sentence introduction explaining:

   - Why this change was needed (the problem)
   - What it accomplishes (the solution)
   - How it flows from setup to validation (the journey)

4. **Order for narrative flow** - Within each concept, order changes to tell the story clearly:

   - Start with "what this is" (data structures, types)
   - Move to "how it works" (core logic)
   - Then "how it integrates" (connections to system)
   - End with "how we verify" (tests, validation)

5. **Explain BEFORE showing code** - Always place explanations before diffs so readers understand context first

6. **Show ALL changes** - Never truncate or omit any modifications

7. **Include context** - Always show surrounding lines for clarity (use `-U5` for git diffs)

8. **Use proper formatting**:

   - Use diff syntax highlighting in code blocks
   - Prefix removed lines with `-`
   - Prefix added lines with `+`
   - Show unchanged context lines without prefix

9. **Provide file paths and line numbers** - Use format `path/to/file:startLine-endLine`

## Example Output Format

This example demonstrates how to present a complete feature that spans multiple files as ONE cohesive narrative.

### Overview

Implemented first-time event tracking for feature flags to enable targeting users based on whether they've performed specific events for the first time.

### Changes by Feature/Concept Story

#### Feature Flag First-Time Event Tracking - Complete Implementation

This feature enables targeting feature flags based on first-time event occurrences. The motivation is to allow product teams to target users who are experiencing features for the first time (e.g., show a tooltip to users visiting the dashboard for the first time). The implementation flows from defining the data model for tracking events, through the API handler that records events, to the storage layer that deduplicates them, ending with comprehensive test coverage. This is a complete end-to-end feature spanning the API, storage, and test layers.

**`handlers/types.go:23-31`** (NEW FILE - excerpt)

_Explanation: Defines the data structure for first-time event tracking requests. This establishes "what this is" - the foundation of our feature with the event name, user ID, and optional metadata._

```diff
+ // FirstTimeEventRequest represents a request to record a first-time event occurrence
+ type FirstTimeEventRequest struct {
+     EventName  string            `json:"event_name"`
+     UserID     string            `json:"user_id"`
+     ProjectID  int               `json:"project_id"`
+     Metadata   map[string]string `json:"metadata,omitempty"`
+ }
```

**`handlers/record_first_time_event.go:1-15`** (NEW FILE - excerpt)

_Explanation: Imports the dependencies needed for the handler. Note how we group the imports with their usage below rather than presenting them separately - they're part of the same story._

```diff
+ package handlers
+
+ import (
+     "encoding/json"
+     "net/http"
+
+     "mixpanel.com/flags/utils"
+     "go.uber.org/zap"
+ )
```

**`handlers/record_first_time_event.go:45-78`** (NEW FILE - excerpt)

_Explanation: Implements the HTTP handler that processes first-time event recording requests. This is "how it works" - the core business logic that validates input, calls the storage layer, and returns appropriate responses. Building on the types defined above, this handler orchestrates the feature._

```diff
+ func RecordFirstTimeEvent(store utils.FeatureFlagsDataStore, logger *zap.Logger) http.HandlerFunc {
+     return func(w http.ResponseWriter, r *http.Request) {
+         var req FirstTimeEventRequest
+         if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
+             http.Error(w, "Invalid request body", http.StatusBadRequest)
+             return
+         }
+
+         // Validate required fields
+         if req.EventName == "" || req.UserID == "" {
+             http.Error(w, "event_name and user_id are required", http.StatusBadRequest)
+             return
+         }
+
+         // Record the event using the storage layer
+         isFirstTime, err := store.RecordFirstTimeEvent(r.Context(), req.ProjectID, req.UserID, req.EventName)
+         if err != nil {
+             logger.Error("Failed to record first-time event", zap.Error(err))
+             http.Error(w, "Internal server error", http.StatusInternalServerError)
+             return
+         }
+
+         w.WriteHeader(http.StatusOK)
+         json.NewEncoder(w).Encode(map[string]bool{"is_first_time": isFirstTime})
+     }
+ }
```

> **💡 AI Suggestion - Obvious Comment**
>
> **Issue:** Lines 359 and 365 contain comments that merely restate what the code does: "Validate required fields" and "Record the event using the storage layer".
>
> **Suggestion:** Remove these comments as they're self-evident from reading the code. The function names and control flow already make the intent clear. Reserve comments for explaining WHY decisions were made or documenting non-obvious business logic.

**`utils/feature_flags_data_store.go:156-189`**

_Explanation: Adds the storage layer method that persists first-time events to Redis. This is "how it integrates" with our data layer - it handles deduplication using Redis SET operations and returns whether this was truly a first occurrence. This uses the handler above to complete the feature's implementation flow._

```diff
  type FeatureFlagsDataStore interface {
      GetFeatureFlag(ctx context.Context, projectID int, flagKey string) (*FeatureFlag, error)
+     RecordFirstTimeEvent(ctx context.Context, projectID int, userID string, eventName string) (bool, error)
  }

  // RecordFirstTimeEvent stores a first-time event occurrence and returns true if this is the first time
+ func (s *redisDataStore) RecordFirstTimeEvent(ctx context.Context, projectID int, userID string, eventName string) (bool, error) {
+     key := fmt.Sprintf("first_time_events:%d:%s:%s", projectID, userID, eventName)
+
+     // Use SET with NX (only set if not exists) to ensure atomicity
+     result, err := s.client.SetNX(ctx, key, "1", 30*24*time.Hour).Result()
+     if err != nil {
+         return false, fmt.Errorf("failed to record first-time event: %w", err)
+     }
+
+     // result is true if the key was set (first time), false if it already existed
+     return result, nil
+ }
```

> **💡 AI Suggestion - Duplication**
>
> **Issue:** The Redis key formatting pattern `fmt.Sprintf("first_time_events:%d:%s:%s", projectID, userID, eventName)` on line 391 appears to duplicate similar key formatting logic found in `utils/cache_keys.go:23-27`, which has a `buildEventKey()` helper function.
>
> **Suggestion:** Reuse the existing `buildEventKey()` helper from `utils/cache_keys.go` instead of manually formatting the key. This ensures consistency in key naming conventions and makes future key format changes easier to maintain.
>
> **Context:** The existing helper in `utils/cache_keys.go` already handles the project, user, and event name parameters in the same format.

**`handlers/record_first_time_event_test.go:1-8`** (NEW FILE - excerpt)

_Explanation: Sets up the test file with necessary imports. Again, grouped with the test implementation below as part of the validation story._

```diff
+ package handlers
+
+ import (
+     "testing"
+     "net/http/httptest"
+     "github.com/stretchr/testify/assert"
+ )
```

**`handlers/record_first_time_event_test.go:34-67`** (NEW FILE - excerpt)

_Explanation: Validates the complete feature with unit tests. This is "how we verify" - comprehensive test coverage including success cases, validation errors, and storage failures. This completes the narrative arc from setup through implementation to validation._

```diff
+ func TestRecordFirstTimeEvent_Success(t *testing.T) {
+     mockStore := &MockDataStore{
+         RecordFirstTimeEventFunc: func(ctx context.Context, projectID int, userID string, eventName string) (bool, error) {
+             return true, nil // First time
+         },
+     }
+
+     handler := RecordFirstTimeEvent(mockStore, zap.NewNop())
+
+     req := httptest.NewRequest("POST", "/record", strings.NewReader(`{
+         "event_name": "dashboard_view",
+         "user_id": "user123",
+         "project_id": 42
+     }`))
+     w := httptest.NewRecorder()
+
+     handler.ServeHTTP(w, req)
+
+     assert.Equal(t, http.StatusOK, w.Code)
+     assert.Contains(t, w.Body.String(), `"is_first_time":true`)
+ }
```

**Key takeaway from this example:**

- ALL changes related to "First-Time Event Tracking" are grouped together in ONE section
- The narrative flows logically: types → handler → storage → tests
- Changes span 4 different files but read as a single coherent story
- Each code block explains how it connects to the overall narrative
- The reader can understand the complete feature without jumping around
- Imports are shown with their usage, not separately
- Code review suggestions are included inline where issues are found
- Each inline suggestion should also be aggregated in the final "Instructions for Claude" section

### Excluded Files

**If any files were excluded in Step 1.5**, add this section at the END of CODE_REVIEW.md (after all concept groups but before "Instructions for Claude"):

```markdown
### Excluded Files

The following files were excluded from detailed review (generated files or build artifacts):

**Staged:**
- dist/bundle.js

**Changed:**
- path/to/file.resolved

**Untracked:**
- .build/debug/artifact
```

**Important formatting:**
- Only include this section if there are excluded files
- Group files by their change type: Staged, Changed (unstaged), Untracked
- Only show groups that have files in them
- Use simple bulleted lists with file paths only
- No diff content, no explanations
- Place this section AFTER all the detailed concept groups but BEFORE "Instructions for Claude"

### Instructions for Claude

After all the concept groups, add a final section that aggregates all code review suggestions in a format optimized for copy-pasting into Claude Code for implementation.

The following improvements were identified during code review. Each can be addressed independently.

### 1. Obvious Comment: Remove Self-Evident Comments from Handler

**File:** `handlers/record_first_time_event.go:359-365`

**Issue:** Lines 359 and 365 contain comments that merely restate what the code does: "Validate required fields" and "Record the event using the storage layer".

**Task:** Remove the obvious comments from the `RecordFirstTimeEvent` handler function. Keep only comments that explain WHY decisions were made or document non-obvious business logic. The function names and control flow already make the intent clear.

**Context:** This is part of the broader pattern of removing comments that don't add information beyond what the code itself conveys.

---

### 2. Duplication: Reuse Existing Key Formatting Helper

**File:** `utils/feature_flags_data_store.go:391`

**Issue:** The Redis key formatting pattern `fmt.Sprintf("first_time_events:%d:%s:%s", projectID, userID, eventName)` duplicates similar key formatting logic found in `utils/cache_keys.go:23-27`, which has a `buildEventKey()` helper function.

**Task:** Replace the manual key formatting in `RecordFirstTimeEvent` with a call to the existing `buildEventKey()` helper from `utils/cache_keys.go`. This ensures consistency in key naming conventions and makes future key format changes easier to maintain.

**Context:** The existing helper in `utils/cache_keys.go` already handles the project, user, and event name parameters in the same format. Import the utility and use: `key := cache_keys.buildEventKey(projectID, userID, eventName)`.

---

**Important formatting requirements for the "Instructions for Claude" section:**

1. **Number each suggestion sequentially** (1, 2, 3, etc.)
2. **Use category prefix in title**: `[Category]: [Brief Description]` (e.g., "Duplication: Extract Common Validation Logic")
3. **Include all required fields**:
   - **File:** Exact file path and line range where the issue occurs
   - **Issue:** Clear description of what's wrong
   - **Task:** Actionable instruction written in imperative form (e.g., "Extract...", "Remove...", "Refactor...")
   - **Context:** Any additional information needed to complete the task, including references to existing code
4. **Make each suggestion self-contained** - Someone should be able to copy-paste the task without re-reading the entire review
5. **Separate suggestions with `---`** for visual clarity
6. **For duplication issues**, always include the path to the existing code that should be reused

---

Begin your review now by detecting all changes and writing them to CODE_REVIEW.md in the format above.

**Critical steps:**
1. Review files listed above (staged, changed, untracked) and identify any excluded files (Step 1.5)
2. Retrieve diffs only for files to review (Step 2)
3. Analyze and group changes by concept/feature (Step 3)
4. Perform code quality review (Step 4) - actively search for duplicates, code smells, obvious comments, and design issues
5. Write the review with inline suggestions in blockquote format
6. Add the "Excluded Files" section if applicable (after concept groups, before Instructions)
7. Add the "Instructions for Claude" section at the end with all suggestions aggregated in copy-pastable format
8. Use the Write tool to create CODE_REVIEW.md
9. Confirm to the user that the review has been written to CODE_REVIEW.md


