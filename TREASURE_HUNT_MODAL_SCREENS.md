# Treasure Hunt Modal Screens Reference

This document lists all screens/views within the Treasure Hunt Modal system for easy identification when making modifications.

## Main Modal Container
- **Location**: `components/TreasureHuntModal.tsx`
- **Common Elements** (appear in all views):
  - Custom X close button (top-right): `/treasure-hunt/x.png`
  - Modal backdrop with blur effect
  - Centered content area with max-width constraints

---

## Screen 1: LIST VIEW (`viewMode === 'list'`)
**Purpose**: Main screen showing all available treasure hunts

**Header Elements**:
- Large logo: `thlogo.png` (full width, max 40vh height)
- "Show clues on the map" text with eye/patch toggle icons (only shown if activeHuntId exists)

**Main Content**:
- List of treasure hunt cards, each showing:
  - Hunt icon (custom or emoji)
  - Hunt name
  - Hunt description
  - Action buttons:
    - **Details** button (blue) - opens Details View
    - **Start** button (green) - for unstarted hunts
    - **Resume** button (yellow) - for started but inactive hunts
    - **Active** button (yellow, highlighted) - for currently active hunt
  - Progress status (if started): Shows current clue number

**Empty State**:
- "No active treasure hunts available" message

---

## Screen 2: DETAILS VIEW (`viewMode === 'details'`)
**Purpose**: Shows detailed information about a specific hunt

**Header Elements**:
- Hunt icon (custom image or emoji) - centered, h-16
- "← Back to hunts" button (top-left)

**Main Content**:
- Hunt name with icon
- Hunt description
- **Hunt Information** section:
  - Total Clues count
  - Progress (current clue / total clues) - if started
  - "Not started yet" - if not started
- **Clues** section (if available):
  - List of all clues with:
    - Clue number (#X)
    - Clue title (text)
    - Clue text preview (first 100 chars)
- Action buttons:
  - **Continue Hunt** (yellow gradient) - if started, goes to Clue View
  - **Start Treasure Hunt** (green gradient) - if not started
  - **Back to List** (gray) - returns to List View

**Loading State**:
- "Loading hunt details..." message

---

## Screen 3: CLUE VIEW (`viewMode === 'clue'`)
**Purpose**: Active gameplay screen for solving clues

**Header Elements**:
- Hunt icon + name
- Hunt description
- "← Back to hunts" button (top-left)

**Main Content Sections**:

### 3A. Not Started State
- "Ready to start your adventure?" message
- **Start Treasure Hunt** button (yellow gradient)

### 3B. In Progress State (when `progress` exists)

**Clue Card**:
- Clue number (#X)
- Distance indicator (if available):
  - Green checkmark + distance if ≤100m
  - Yellow warning + distance if >100m
- **Clue Title** (supports images):
  - If title is an image URL: Displays as large image (max 50vh height, full width)
  - If title is text: Displays as heading
- Clue text
- Hint section (collapsible):
  - "💡 Need a hint?" expandable details

**Answer Input Section**:
- Text input field for answer
- **Submit Answer** button (yellow gradient):
  - Disabled if distance > 100m
  - Shows "Get closer! (Xm away)" if too far
- Distance warning message (if >100m)

**Success/Error Messages**:
- Green success message (when answer is correct)
- Red error message (when answer is wrong or error occurs)
- Yellow authentication warning (if login required)

**Progress Indicator** (bottom):
- Progress bar showing: (current_clue - 1) / total_clues
- Visual progress bar with yellow-orange gradient

**Loading State**:
- "Loading clue..." message

---

## Additional UI Elements (appear conditionally)

### Authentication Error Banner
- Appears at top of any view when auth is required
- Yellow warning style
- Shows: "⚠️ Authentication Required" with message

### Loading States
- Various loading messages throughout different views
- "Loading hunt details..."
- "Loading clue..."
- "Starting..."
- "Checking..."

---

## Navigation Flow

```
LIST VIEW
  ├─> Click "Details" → DETAILS VIEW
  ├─> Click "Start" → CLUE VIEW (starts hunt)
  ├─> Click "Resume" → CLUE VIEW (continues hunt)
  └─> Click "Active" → CLUE VIEW (shows current clue)

DETAILS VIEW
  ├─> Click "← Back to hunts" → LIST VIEW
  ├─> Click "Continue Hunt" → CLUE VIEW
  ├─> Click "Start Treasure Hunt" → CLUE VIEW (starts hunt)
  └─> Click "Back to List" → LIST VIEW

CLUE VIEW
  └─> Click "← Back to hunts" → LIST VIEW
```

---

## Key Identifiers for Modifications

### To modify LIST VIEW:
- Look for: `viewMode === 'list'`
- Line range: ~385-526

### To modify DETAILS VIEW:
- Look for: `viewMode === 'details' && selectedHunt`
- Line range: ~527-648

### To modify CLUE VIEW:
- Look for: `selectedHunt` (after details check)
- Line range: ~649-809

### To modify logo:
- List view logo: Line ~352-359
- Details view icon: Line ~361-373

### To modify close button:
- Line ~344-350

### To modify clue title images:
- Line ~718-734








