// 优化参数 - 先在固定区域识别水印，再精确擦除
// 包装在 IIFE 中以避免全局污染
(function() {
  'use strict';

  function getDefaultParams() {
  return {
    roiWidthPercent: 7,    // 缩小搜索区域到 7%
    roiHeightPercent: 7,   // 缩小搜索区域到 7%
    rightMarginPercent: 2, // 右边距 2%
    bottomMarginPercent: 2, // 下边距 2%
    inpaintMethod: 'telea', // 使用 TELEA 算法
    inpaintRadius: 3,       // 修复半径
    
    // 水印检测参数
    thresholdMethod: 'adaptive', // 'adaptive' 或 'otsu'
    blockSize: 11,          // 自适应阈值块大小
    c: 2,                   // 自适应阈值常数
    morphKernelSize: 3,     // 形态学核大小
    morphIterations: 1,     // 形态学迭代次数
    minContourArea: 100,    // 最小轮廓面积
    maxContourArea: 50000,  // 最大轮廓面积
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
  
  // 水印检测配置
  const thresholdMethod = p.thresholdMethod || 'adaptive'
  const blockSize = Math.max(3, p.blockSize % 2 === 0 ? p.blockSize + 1 : p.blockSize) // 确保是奇数
  const c = Math.max(0, p.c ?? 2)
  const morphKernelSize = Math.max(1, p.morphKernelSize % 2 === 0 ? p.morphKernelSize + 1 : p.morphKernelSize) // 确保是奇数
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

  // 在 ROI 区域内检测水印位置
  function detectWatermarkInROI(cv, roiMat, cfg, track) {
  // 转换为灰度图
  const gray = track(new cv.Mat())
  if (roiMat.channels() === 4) {
    cv.cvtColor(roiMat, gray, cv.COLOR_RGBA2GRAY)
  } else if (roiMat.channels() === 3) {
    cv.cvtColor(roiMat, gray, cv.COLOR_RGB2GRAY)
  } else {
    gray.delete()
    return roiMat.clone()
  }

  // 应用阈值
  const thresh = track(new cv.Mat())
  if (cfg.thresholdMethod === 'otsu') {
    cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
  } else {
    // 自适应阈值
    cv.adaptiveThreshold(gray, thresh, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, cfg.blockSize, cfg.c)
  }

  // 形态学操作清理噪音
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(cfg.morphKernelSize, cfg.morphKernelSize))
  const morphed = track(new cv.Mat())
  cv.morphologyEx(thresh, morphed, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), cfg.morphIterations)
  kernel.delete()

  // 查找轮廓
  const contours = new cv.MatVector()
  const hierarchy = track(new cv.Mat())
  cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

  // 创建精确的水印蒙版
  const preciseMask = track(cv.Mat.zeros(roiMat.rows, roiMat.cols, cv.CV_8UC1))
  
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i)
    const area = cv.contourArea(contour)
    
    // 过滤掉太小或太大的区域
    if (area >= cfg.minContourArea && area <= cfg.maxContourArea) {
      // 创建轮廓的边界框并填充
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

  // 将 ROI 蒙版映射回全图坐标
  function mapROIMaskToFullImage(cv, roiMask, fullImageSize, roiRect, track) {
  const fullMask = track(cv.Mat.zeros(fullImageSize.height, fullImageSize.width, cv.CV_8UC1))
  const roiRegion = fullMask.roi(roiRect)
  roiMask.copyTo(roiRegion)
  roiRegion.delete()
  return fullMask
}

  // 优化版水印去除 - 先在固定区域检测水印，再精确擦除
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

    // 步骤1: 计算右下角搜索区域
    const roiRect = computeBottomRightRoiRect(cv, srcRgba.cols, srcRgba.rows, cfg)
    
    // 步骤2: 提取 ROI 区域
    const roiMat = track(srcRgba.roi(roiRect))
    
    // 步骤3: 在 ROI 内进行精确水印检测
    const roiMask = detectWatermarkInROI(cv, roiMat, cfg, track)
    
    // 步骤4: 将 ROI 蒙版映射回全图
    const fullMask = mapROIMaskToFullImage(cv, roiMask, imageSize, roiRect, track)
    
    // 步骤5: 应用形态学膨胀以获得更好的修复效果
    const dilateKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(cfg.inpaintRadius * 2 + 1, cfg.inpaintRadius * 2 + 1))
    const dilatedMask = track(new cv.Mat())
    cv.dilate(fullMask, dilatedMask, dilateKernel, new cv.Point(-1, -1), 1)
    dilateKernel.delete()

    // 步骤6: 转换颜色空间并进行修复
    const srcBgr = track(new cv.Mat())
    cv.cvtColor(srcRgba, srcBgr, cv.COLOR_RGBA2BGR)
    const dstBgr = track(new cv.Mat())
    cv.inpaint(srcBgr, dilatedMask, dstBgr, cfg.inpaintRadius, cfg.inpaintMethodConst)

    // 步骤7: 转换回 RGBA
    const dstRgba = track(new cv.Mat())
    cv.cvtColor(dstBgr, dstRgba, cv.COLOR_BGR2RGBA)

    // 为了可视化，创建彩色蒙版
    const maskRgba = track(new cv.Mat())
    cv.cvtColor(dilatedMask, maskRgba, cv.COLOR_GRAY2RGBA)

    return { 
      mask: matToImageData(cv, maskRgba), 
      result: matToImageData(cv, dstRgba),
      // 额外返回检测统计信息
      stats: {
        roiArea: roiRect.width * roiRect.height,
        totalArea: imageSize.width * imageSize.height,
        roiPercent: ((roiRect.width * roiRect.height) / (imageSize.width * imageSize.height) * 100).toFixed(1)
      }
    }
  } finally {
    // 清理资源
    try {
      matsToDelete.forEach((m) => {
        if (m && typeof m.delete === 'function') m.delete()
      })
    } catch {
      // noop
    }
  }
}

  // 将主要函数暴露到全局作用域
  window.runWatermarkPipeline = runWatermarkPipeline;
  window.getDefaultParams = getDefaultParams;
  window.getPipelineConfig = getPipelineConfig;
  window.matToImageData = matToImageData;

  console.log('[Watermark Pipeline] 水印处理管道已加载到全局作用域');

})(); // 结束 IIFE
