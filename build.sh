#!/bin/bash

# Build script for Gemini Watermark Cleaner Chrome Extension
# Author: Suryanand - suryanand.com

set -e

echo "🔨 Building Gemini Watermark Cleaner Extension..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validate manifest
echo -e "${BLUE}✓${NC} Validating manifest.json..."
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
if (!manifest.name || !manifest.version) {
  console.error('❌ Invalid manifest.json');
  process.exit(1);
}
console.log('✓ Manifest valid:', manifest.name, 'v' + manifest.version);
"

# Check required files
echo -e "${BLUE}✓${NC} Checking required files..."
required_files=(
  "manifest.json"
  "background.js"
  "popup.html"
  "content-scripts/content.js"
  "watermark-pipeline.js"
  "fetch-interceptor.js"
  "opencv-injector.js"
  "icon/128.png"
)

missing_files=()
for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    missing_files+=("$file")
  fi
done

if [ ${#missing_files[@]} -gt 0 ]; then
  echo "❌ Missing required files:"
  printf '   %s\n' "${missing_files[@]}"
  exit 1
fi

echo -e "${GREEN}✓${NC} All required files present"

# Check for Chinese content
echo -e "${BLUE}✓${NC} Checking for Chinese content..."
if command -v python3 &> /dev/null; then
  python3 -c "
import re
import os
chinese_pattern = re.compile(r'[\u4e00-\u9fff]+')
files_to_check = ['manifest.json', 'popup.html', 'README.md', 'background.js', 'fetch-interceptor.js', 'watermark-pipeline.js', 'opencv-injector.js', 'content-scripts/content.js']
found_chinese = False
for f in files_to_check:
    if os.path.exists(f):
        content = open(f, 'rb').read().decode('utf-8', errors='ignore')
        if chinese_pattern.search(content):
            print(f'⚠️  Warning: Chinese content found in {f}')
            found_chinese = True
if not found_chinese:
    print('✓ No Chinese content found')
" || echo "⚠️  Python check skipped"
fi

# Create package
VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('manifest.json')).version)")
PACKAGE_NAME="gemini-watermark-cleaner-v${VERSION}.zip"

echo -e "${BLUE}✓${NC} Creating package: ${PACKAGE_NAME}..."

# Clean old packages
rm -f *.zip

# Create zip package
zip -r "$PACKAGE_NAME" . \
  -x "*.git*" \
  -x "*.zip" \
  -x "node_modules/*" \
  -x "*.DS_Store" \
  -x ".vscode/*" \
  -x ".idea/*" \
  -x "*.log" \
  -x "build.sh" \
  > /dev/null

if [ -f "$PACKAGE_NAME" ]; then
  SIZE=$(du -h "$PACKAGE_NAME" | cut -f1)
  echo -e "${GREEN}✓${NC} Package created successfully: ${PACKAGE_NAME} (${SIZE})"
else
  echo "❌ Failed to create package"
  exit 1
fi

echo ""
echo -e "${GREEN}🎉 Build completed successfully!${NC}"
echo ""
echo "To install the extension:"
echo "  1. Open Chrome and go to chrome://extensions/"
echo "  2. Enable 'Developer mode'"
echo "  3. Click 'Load unpacked' and select this directory"
echo ""
echo "Or use the packaged file: ${PACKAGE_NAME}"

