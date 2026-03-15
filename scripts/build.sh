#!/bin/bash

# Build script that temporarily removes test files from zeus build
# Zeus CLI scans all JS files including vitest.config.js and tests/,
# which causes it to fail when trying to parse vite's modern JS syntax

set -e

# Items to temporarily remove
REMOVE_ITEMS=("vitest.config.js" "tests" "tests/setup.js")

# Function to remove items
remove_items() {
    for item in "${REMOVE_ITEMS[@]}"; do
        if [ -e "$item" ]; then
            rm -rf "$item"
        fi
    done
}

# Function to restore items using git
restore_items() {
    git checkout -- vitest.config.js tests 2>/dev/null || true
}

# Trap to ensure items are restored on exit
trap restore_items EXIT

# Remove test files
remove_items

# Run the build
echo 'all' | zeus build
