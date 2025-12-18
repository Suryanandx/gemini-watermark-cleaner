// Optimized parameters - detect watermark in fixed region first, then precisely remove
// Wrapped in IIFE to avoid global pollution
(function() {
  'use strict';

  function getDefaultParams() {
  return {
    roiWidthPercent: 7,    // Reduce search area to 7%
    roiHeightPercent: 7,   // Reduce search area to 7%
    rightMarginPercent: 2, // Right margin 2%
    bottomMarginPercent: 2, // Bottom margin 2%
    inpaintMethod: 'telea', // Use TELEA algorithm
    inpaintRadius: 3,       // Inpaint radius
    
    // Watermark detection parameters
    thresholdMethod: 'adaptive', // 'adaptive' or 'otsu'
    blockSize: 11,          // Adaptive threshold block size
    c: 2,                   // Adaptive threshold constant
    morphKernelSize: 3,     // Morphological kernel size
    morphIterations: 1,     // Morphological iterations
    minContourArea: 100,    // Minimum contour area
    maxContourArea: 50000,  // Maximum contour area
  }
}



  function getPipelineConfig(cv, params = {}) {
  const p = { ...getDefaultParams(), ...params }

  const inpaintMethodConst = p.inpaintMethod === 'ns' ? cv.INPAINT_NS : cv.INPAINT_TELEA
  const inpaintRadius = Math.max(1, Math.round(p.inpaintRadius ?? 3))
  const roiWidthPercent = Math.min(100, Math.max(1, Math.round(p.roiWidthPercent ?? 10)))
  const roiHeightPercent = Math.min(100, Math.max(1, Math.round(p.roiHeightPercent ?? 10)))
  const rightMarginPercent = Math.min(100, Math.max(0, Math.round(p.rightMarginPercent ?? 2)))
  const bottomMarginPercent = Math.min(100, Math.max(0, Math.round(p.bottomMarginPercent ?? 2)))
  
  // Watermark detection configuration
  const thresholdMethod = p.thresholdMethod || 'adaptive'
  const blockSize = Math.max(3, p.blockSize % 2 === 0 ? p.blockSize + 1 : p.blockSize) // Ensure it's odd
  const c = Math.max(0, p.c ?? 2)
  const morphKernelSize = Math.max(1, p.morphKernelSize % 2 === 0 ? p.morphKernelSize + 1 : p.morphKernelSize) // Ensure it's odd
  const morphIterations = Math.max(1, Math.round(p.morphIterations ?? 1))
  const minContourArea = Math.max(1, Math.round(p.minContourArea ?? 100))
  const maxContourArea = Math.max(minContourArea, Math.round(p.maxContourArea ?? 50000))

  return {
    inpaintMethodConst,
    inpaintRadius,
    roiWidthPercent,
    roiHeightPercent,
    rightMarginPercent,
    bottomMarginPercent,
    thresholdMethod,
    blockSize,
    c,
    morphKernelSize,
    morphIterations,
    minContourArea,
    maxContourArea,
  }
}

  function matToImageData(cv, mat) {
  const img = new ImageData(new Uint8ClampedArray(mat.data), mat.cols, mat.rows)
  return img
}



  function computeBottomRightRoiRect(cv, width, height, cfg) {
  const w = Math.max(1, Math.round((cfg.roiWidthPercent / 100) * width))
  const h = Math.max(1, Math.round((cfg.roiHeightPercent / 100) * height))
  const rightMargin = Math.round((cfg.rightMarginPercent / 100) * width)
  const bottomMargin = Math.round((cfg.bottomMarginPercent / 100) * height)
  const x = Math.max(0, width - w - rightMargin)
  const y = Math.max(0, height - h - bottomMargin)
  return new cv.Rect(x, y, Math.min(w, width - x), Math.min(h, height - y))
}

  // Detect watermark position in ROI region
  function detectWatermarkInROI(cv, roiMat, cfg, track) {
  // Convert to grayscale
  const gray = track(new cv.Mat())
  if (roiMat.channels() === 4) {
    cv.cvtColor(roiMat, gray, cv.COLOR_RGBA2GRAY)
  } else if (roiMat.channels() === 3) {
    cv.cvtColor(roiMat, gray, cv.COLOR_RGB2GRAY)
  } else {
    gray.delete()
    return roiMat.clone()
  }

  // Apply threshold
  const thresh = track(new cv.Mat())
  if (cfg.thresholdMethod === 'otsu') {
    cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
  } else {
    // Adaptive threshold
    cv.adaptiveThreshold(gray, thresh, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, cfg.blockSize, cfg.c)
  }

  // Morphological operations to clean noise
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(cfg.morphKernelSize, cfg.morphKernelSize))
  const morphed = track(new cv.Mat())
  cv.morphologyEx(thresh, morphed, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), cfg.morphIterations)
  kernel.delete()

  // Find contours
  const contours = new cv.MatVector()
  const hierarchy = track(new cv.Mat())
  cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

  // Create precise watermark mask
  const preciseMask = track(cv.Mat.zeros(roiMat.rows, roiMat.cols, cv.CV_8UC1))
  
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i)
    const area = cv.contourArea(contour)
    
    // Filter out areas that are too small or too large
    if (area >= cfg.minContourArea && area <= cfg.maxContourArea) {
      // Create bounding box of contour and fill
      const rect = cv.boundingRect(contour)
      const rectPoint1 = new cv.Point(rect.x, rect.y)
      const rectPoint2 = new cv.Point(rect.x + rect.width, rect.y + rect.height)
      cv.rectangle(preciseMask, rectPoint1, rectPoint2, new cv.Scalar(255), -1)
    }
    contour.delete()
  }
  
  contours.delete()
  return preciseMask
}

  // Map ROI mask back to full image coordinates
  function mapROIMaskToFullImage(cv, roiMask, fullImageSize, roiRect, track) {
  const fullMask = track(cv.Mat.zeros(fullImageSize.height, fullImageSize.width, cv.CV_8UC1))
  const roiRegion = fullMask.roi(roiRect)
  roiMask.copyTo(roiRegion)
  roiRegion.delete()
  return fullMask
}

  // Optimized watermark removal - detect watermark in fixed region first, then precisely remove
  function runWatermarkPipeline(cv, srcImageData, params = {}) {
  const cfg = getPipelineConfig(cv, params)

  const matsToDelete = []
  const track = (m) => {
    matsToDelete.push(m)
    return m
  }

  try {
    const srcRgba = track(cv.matFromImageData(srcImageData))
    const imageSize = { width: srcRgba.cols, height: srcRgba.rows }

    // Step 1: Calculate bottom-right search region
    const roiRect = computeBottomRightRoiRect(cv, srcRgba.cols, srcRgba.rows, cfg)
    
    // Step 2: Extract ROI region
    const roiMat = track(srcRgba.roi(roiRect))
    
    // Step 3: Perform precise watermark detection in ROI
    const roiMask = detectWatermarkInROI(cv, roiMat, cfg, track)
    
    // Step 4: Map ROI mask back to full image
    const fullMask = mapROIMaskToFullImage(cv, roiMask, imageSize, roiRect, track)
    
    // Step 5: Apply morphological dilation for better inpainting results
    const dilateKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(cfg.inpaintRadius * 2 + 1, cfg.inpaintRadius * 2 + 1))
    const dilatedMask = track(new cv.Mat())
    cv.dilate(fullMask, dilatedMask, dilateKernel, new cv.Point(-1, -1), 1)
    dilateKernel.delete()

    // Step 6: Convert color space and perform inpainting
    const srcBgr = track(new cv.Mat())
    cv.cvtColor(srcRgba, srcBgr, cv.COLOR_RGBA2BGR)
    const dstBgr = track(new cv.Mat())
    cv.inpaint(srcBgr, dilatedMask, dstBgr, cfg.inpaintRadius, cfg.inpaintMethodConst)

    // Step 7: Convert back to RGBA
    const dstRgba = track(new cv.Mat())
    cv.cvtColor(dstBgr, dstRgba, cv.COLOR_BGR2RGBA)

    // Create colored mask for visualization
    const maskRgba = track(new cv.Mat())
    cv.cvtColor(dilatedMask, maskRgba, cv.COLOR_GRAY2RGBA)

    return { 
      mask: matToImageData(cv, maskRgba), 
      result: matToImageData(cv, dstRgba),
      // Additionally return detection statistics
      stats: {
        roiArea: roiRect.width * roiRect.height,
        totalArea: imageSize.width * imageSize.height,
        roiPercent: ((roiRect.width * roiRect.height) / (imageSize.width * imageSize.height) * 100).toFixed(1)
      }
    }
  } finally {
    // Clean up resources
    try {
      matsToDelete.forEach((m) => {
        if (m && typeof m.delete === 'function') m.delete()
      })
    } catch {
      // noop
    }
  }
}

  // Expose main functions to global scope
  window.runWatermarkPipeline = runWatermarkPipeline;
  window.getDefaultParams = getDefaultParams;
  window.getPipelineConfig = getPipelineConfig;
  window.matToImageData = matToImageData;

  console.log('[Watermark Pipeline] Watermark processing pipeline loaded to global scope');

})(); // End IIFE
