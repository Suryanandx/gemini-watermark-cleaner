# Gemini Watermark Cleaner

An intelligent browser extension designed specifically for Google Gemini that automatically detects and removes watermarks from downloaded images, providing a seamless watermark-free experience.

## Features

- **Automatic Watermark Detection**: Uses advanced computer vision algorithms to detect watermarks in images
- **Intelligent Removal**: Precisely removes watermarks while preserving image quality
- **Real-time Processing**: Processes images automatically as they are downloaded
- **Optimized Performance**: Efficient ROI-based detection for fast processing
- **Memory Efficient**: Proper resource management and cleanup

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension will be installed and ready to use

## Usage

1. Navigate to [Google Gemini](https://gemini.google.com)
2. Download images as you normally would
3. The extension will automatically process images and remove watermarks
4. Processed images will be saved without watermarks

## Technical Details

### Architecture

- **Content Script**: Injects processing scripts into Gemini pages
- **OpenCV Integration**: Uses OpenCV.js (WASM) for image processing
- **Fetch Interceptor**: Intercepts image requests and processes them
- **Watermark Pipeline**: Advanced algorithm for watermark detection and removal

### Processing Pipeline

1. Detects watermarks in the bottom-right region of images (7% ROI)
2. Uses adaptive thresholding and morphological operations
3. Creates precise masks for watermark areas
4. Applies inpainting algorithms to remove watermarks
5. Returns processed images seamlessly

### Performance

- Maximum image size: 10MB
- Minimum image size: 10x10 pixels
- Maximum image dimensions: 10000x10000 pixels
- Caching: Processed images are cached for faster subsequent loads

## Browser Compatibility

- Chrome (Manifest V3)
- Edge (Chromium-based)
- Other Chromium-based browsers

## Requirements

- Chrome/Edge browser with Manifest V3 support
- No additional dependencies required

## Development

The extension uses:
- OpenCV.js 4.12.0 (WASM)
- Vanilla JavaScript (no frameworks)
- Chrome Extension APIs

## License

This project is provided as-is for educational and personal use.

## License

This project is provided as-is for educational and personal use.

## Author & Support

**Created by Suryanand**  
🌐 Website: [suryanand.com](https://suryanand.com)  
📧 GitHub: [@Suryanandx](https://github.com/Suryanandx)

---

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/Suryanandx/gemini-watermark-cleaner).


<!-- Updated Thu Dec 18 20:33:24 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:24 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:24 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Updated Thu Dec 18 20:33:25 IST 2025 -->

<!-- Recent update -->

<!-- Recent update -->

<!-- Recent update -->

<!-- Recent update -->

<!-- Recent update -->

<!-- Day 0, commit 1 -->

<!-- Day 0, commit 2 -->

<!-- Day 0, commit 3 -->

<!-- Day 1, commit 1 -->

<!-- Day 1, commit 2 -->

<!-- Day 1, commit 3 -->

<!-- Day 2, commit 1 -->

<!-- Day 2, commit 2 -->

<!-- Day 2, commit 3 -->

<!-- Day 3, commit 1 -->

<!-- Day 3, commit 2 -->

<!-- Day 3, commit 3 -->

<!-- Day 4, commit 1 -->

<!-- Day 4, commit 2 -->

<!-- Day 4, commit 3 -->

<!-- Day 5, commit 1 -->

<!-- Day 5, commit 2 -->

<!-- Day 5, commit 3 -->

<!-- Day 6, commit 1 -->

<!-- Day 6, commit 2 -->

<!-- Day 6, commit 3 -->

<!-- Day 7, commit 1 -->

<!-- Day 7, commit 2 -->

<!-- Day 7, commit 3 -->

<!-- Day 8, commit 1 -->

<!-- Day 8, commit 2 -->

<!-- Day 8, commit 3 -->

<!-- Day 9, commit 1 -->

<!-- Day 9, commit 2 -->

<!-- Day 9, commit 3 -->

<!-- Day 10, commit 1 -->

<!-- Day 10, commit 2 -->

<!-- Day 10, commit 3 -->

<!-- Day 11, commit 1 -->

<!-- Day 11, commit 2 -->

<!-- Day 11, commit 3 -->

<!-- Day 12, commit 1 -->

<!-- Day 12, commit 2 -->

<!-- Day 12, commit 3 -->

<!-- Day 13, commit 1 -->

<!-- Day 13, commit 2 -->

<!-- Day 13, commit 3 -->

<!-- Day 14, commit 1 -->

<!-- Day 14, commit 2 -->

<!-- Day 14, commit 3 -->

<!-- Day 15, commit 1 -->

<!-- Day 15, commit 2 -->

<!-- Day 15, commit 3 -->

<!-- Day 16, commit 1 -->

<!-- Day 16, commit 2 -->

<!-- Day 16, commit 3 -->

<!-- Day 17, commit 1 -->

<!-- Day 17, commit 2 -->

<!-- Day 17, commit 3 -->

<!-- Day 0, commit 1 -->

<!-- Day 0, commit 2 -->

<!-- Day 0, commit 3 -->

<!-- Day 1, commit 1 -->

<!-- Day 1, commit 2 -->

<!-- Day 1, commit 3 -->

<!-- Day 2, commit 1 -->

<!-- Day 2, commit 2 -->

<!-- Day 2, commit 3 -->

<!-- Day 3, commit 1 -->

<!-- Day 3, commit 2 -->

<!-- Day 3, commit 3 -->

<!-- Day 4, commit 1 -->

<!-- Day 4, commit 2 -->

<!-- Day 4, commit 3 -->

<!-- Day 5, commit 1 -->

<!-- Day 5, commit 2 -->

<!-- Day 5, commit 3 -->

<!-- Day 6, commit 1 -->

<!-- Day 6, commit 2 -->

<!-- Day 6, commit 3 -->

<!-- Day 7, commit 1 -->

<!-- Day 7, commit 2 -->

<!-- Day 7, commit 3 -->

<!-- Day 8, commit 1 -->

<!-- Day 8, commit 2 -->

<!-- Day 8, commit 3 -->

<!-- Day 9, commit 1 -->

<!-- Day 9, commit 2 -->

<!-- Day 9, commit 3 -->

<!-- Day 10, commit 1 -->

<!-- Day 10, commit 2 -->

<!-- Day 10, commit 3 -->

<!-- Day 11, commit 1 -->

<!-- Day 11, commit 2 -->

<!-- Day 11, commit 3 -->

<!-- Day 12, commit 1 -->

<!-- Day 12, commit 2 -->

<!-- Day 12, commit 3 -->

<!-- Day 13, commit 1 -->

<!-- Day 13, commit 2 -->

<!-- Day 13, commit 3 -->

<!-- Day 14, commit 1 -->

<!-- Day 14, commit 2 -->

<!-- Day 14, commit 3 -->

<!-- Day 15, commit 1 -->

<!-- Day 15, commit 2 -->

<!-- Day 15, commit 3 -->

<!-- Day 16, commit 1 -->

<!-- Day 16, commit 2 -->

<!-- Day 16, commit 3 -->

<!-- Day 17, commit 1 -->

<!-- Day 17, commit 2 -->

<!-- Day 17, commit 3 -->

<!-- Day 18, commit 1 -->

<!-- Day 18, commit 2 -->

<!-- Day 18, commit 3 -->

<!-- Day 19, commit 1 -->

<!-- Day 19, commit 2 -->

<!-- Day 19, commit 3 -->

<!-- Day 20, commit 1 -->

<!-- Day 20, commit 2 -->

<!-- Day 20, commit 3 -->

<!-- Day 21, commit 1 -->

<!-- Day 21, commit 2 -->

<!-- Day 21, commit 3 -->

<!-- Day 22, commit 1 -->

<!-- Day 22, commit 2 -->

<!-- Day 22, commit 3 -->

<!-- Day 23, commit 1 -->

<!-- Day 23, commit 2 -->

<!-- Day 23, commit 3 -->

<!-- Day 24, commit 1 -->

<!-- Day 24, commit 2 -->

<!-- Day 24, commit 3 -->

<!-- Day 25, commit 1 -->

<!-- Day 25, commit 2 -->

<!-- Day 25, commit 3 -->

<!-- Day 26, commit 1 -->

<!-- Day 26, commit 2 -->
