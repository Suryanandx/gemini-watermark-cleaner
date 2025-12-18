(function() {
  'use strict';

  function getDefaultParams() {
  return {
    roiWidthPercent: 7,
    roiHeightPercent: 7,
    rightMarginPercent: 2,
    bottomMarginPercent: 2,
    inpaintMethod: 'telea',
    inpaintRadius: 3,
    thresholdMethod: 'adaptive',
    blockSize: 11,
    c: 2,
    morphKernelSize: 3,
    morphIterations: 1,
    minContourArea: 100,
    maxContourArea: 50000,
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
  
  const thresholdMethod = p.thresholdMethod || 'adaptive'
  const blockSize = Math.max(3, p.blockSize % 2 === 0 ? p.blockSize + 1 : p.blockSize)
  const c = Math.max(0, p.c ?? 2)
  const morphKernelSize = Math.max(1, p.morphKernelSize % 2 === 0 ? p.morphKernelSize + 1 : p.morphKernelSize)
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

  function detectWatermarkInROI(cv, roiMat, cfg, track) {
  const gray = track(new cv.Mat())
  if (roiMat.channels() === 4) {
    cv.cvtColor(roiMat, gray, cv.COLOR_RGBA2GRAY)
  } else if (roiMat.channels() === 3) {
    cv.cvtColor(roiMat, gray, cv.COLOR_RGB2GRAY)
  } else {
    gray.delete()
    return roiMat.clone()
  }

  const thresh = track(new cv.Mat())
  if (cfg.thresholdMethod === 'otsu') {
    cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
  } else {
    cv.adaptiveThreshold(gray, thresh, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, cfg.blockSize, cfg.c)
  }

  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(cfg.morphKernelSize, cfg.morphKernelSize))
  const morphed = track(new cv.Mat())
  cv.morphologyEx(thresh, morphed, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), cfg.morphIterations)
  kernel.delete()

  const contours = new cv.MatVector()
  const hierarchy = track(new cv.Mat())
  cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

  const preciseMask = track(cv.Mat.zeros(roiMat.rows, roiMat.cols, cv.CV_8UC1))
  
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i)
    const area = cv.contourArea(contour)
    
    if (area >= cfg.minContourArea && area <= cfg.maxContourArea) {
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

  function mapROIMaskToFullImage(cv, roiMask, fullImageSize, roiRect, track) {
  const fullMask = track(cv.Mat.zeros(fullImageSize.height, fullImageSize.width, cv.CV_8UC1))
  const roiRegion = fullMask.roi(roiRect)
  roiMask.copyTo(roiRegion)
  roiRegion.delete()
  return fullMask
}

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

    const roiRect = computeBottomRightRoiRect(cv, srcRgba.cols, srcRgba.rows, cfg)
    
    const roiMat = track(srcRgba.roi(roiRect))
    
    const roiMask = detectWatermarkInROI(cv, roiMat, cfg, track)
    
    const fullMask = mapROIMaskToFullImage(cv, roiMask, imageSize, roiRect, track)
    
    const dilateKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(cfg.inpaintRadius * 2 + 1, cfg.inpaintRadius * 2 + 1))
    const dilatedMask = track(new cv.Mat())
    cv.dilate(fullMask, dilatedMask, dilateKernel, new cv.Point(-1, -1), 1)
    dilateKernel.delete()

    const srcBgr = track(new cv.Mat())
    cv.cvtColor(srcRgba, srcBgr, cv.COLOR_RGBA2BGR)
    const dstBgr = track(new cv.Mat())
    cv.inpaint(srcBgr, dilatedMask, dstBgr, cfg.inpaintRadius, cfg.inpaintMethodConst)

    const dstRgba = track(new cv.Mat())
    cv.cvtColor(dstBgr, dstRgba, cv.COLOR_BGR2RGBA)

    const maskRgba = track(new cv.Mat())
    cv.cvtColor(dilatedMask, maskRgba, cv.COLOR_GRAY2RGBA)

    return { 
      mask: matToImageData(cv, maskRgba), 
      result: matToImageData(cv, dstRgba),
      stats: {
        roiArea: roiRect.width * roiRect.height,
        totalArea: imageSize.width * imageSize.height,
        roiPercent: ((roiRect.width * roiRect.height) / (imageSize.width * imageSize.height) * 100).toFixed(1)
      }
    }
  } finally {
    try {
      matsToDelete.forEach((m) => {
        if (m && typeof m.delete === 'function') m.delete()
      })
    } catch {
    }
  }
}

  window.runWatermarkPipeline = runWatermarkPipeline;
  window.getDefaultParams = getDefaultParams;
  window.getPipelineConfig = getPipelineConfig;
  window.matToImageData = matToImageData;

  console.log('[Watermark Pipeline] Watermark processing pipeline loaded to global scope');

})();
