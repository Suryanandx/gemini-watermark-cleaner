/**
 * Fetch 拦截器 - 纯 JavaScript 版本
 * 这个文件会被注入到 Gemini 页面的上下文中
 */

(function() {
  'use strict';
  
  console.log('[Fetch Interceptor] 开始初始化 Fetch 拦截器');
  
  // 工具函数
  const utils = {
    shouldProcessImage: function(url, response) {
      try {
        let urlString;
        if (typeof url === 'string') {
          urlString = url;
        } else if (url instanceof URL) {
          urlString = url.href;
        } else if (url instanceof Request) {
          urlString = url.url;
        } else {
          return false;
        }

        const isGoogleImage = /lh3\.(googleusercontent|google)\.com/.test(urlString);
        
        if (!response.ok) {
          return false;
        }
        
        const contentType = response.headers.get('content-type') || '';
        const isImage = /^image\/(jpeg|jpg|png|webp|gif|bmp|tiff)$/i.test(contentType);
        
        return isGoogleImage && isImage;
      } catch (error) {
        console.warn('[Fetch Interceptor] 检查图片请求时出错:', error);
        return false;
      }
    },

    arrayBufferToImageData: async function(buffer) {
      try {
        const blob = new Blob([buffer]);
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('无法获取 OffscreenCanvas 2D 上下文');
        }
        
        ctx.drawImage(bitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
        
        bitmap.close();
        
        return imageData;
      } catch (error) {
        throw new Error('ArrayBuffer 转 ImageData 失败: ' + error);
      }
    },

    imageDataToBlob: async function(imageData, type, quality) {
      type = type || 'image/png';
      quality = quality || 0.95;
      
      try {
        const canvas = new OffscreenCanvas(imageData.width, imageData.height);
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('无法获取 OffscreenCanvas 2D 上下文');
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        const blob = await canvas.convertToBlob({
          type: type,
          quality: quality
        });
        
        return blob;
      } catch (error) {
        throw new Error('ImageData 转 Blob 失败: ' + error);
      }
    },

    createResponseFromArrayBuffer: function(buffer, originalResponse) {
      return new Response(buffer, {
        status: originalResponse.status,
        statusText: originalResponse.statusText,
        headers: new Headers(originalResponse.headers)
      });
    },

    createResponseFromBlob: function(blob, originalResponse) {
      const headers = new Headers(originalResponse.headers);
      headers.set('content-length', blob.size.toString());
      
      return new Response(blob, {
        status: originalResponse.status,
        statusText: originalResponse.statusText,
        headers: headers
      });
    },

    isOpenCVReady: function() {
      try {
        return !!(window.cv && typeof window.cv.Mat === 'function');
      } catch {
        return false;
      }
    },

    waitForOpenCV: function(timeout) {
      timeout = timeout || 10000; // 默认10秒超时
      
      return new Promise(function(resolve, reject) {
        const startTime = Date.now();
        
        function checkOpenCV() {
          if (utils.isOpenCVReady()) {
            utils.logger.info('OpenCV 检测成功');
            resolve(true);
            return;
          }
          
          const elapsed = Date.now() - startTime;
          if (elapsed >= timeout) {
            utils.logger.warn('OpenCV 检测超时 (' + timeout + 'ms)');
            reject(new Error('OpenCV 检测超时'));
            return;
          }
          
          // 使用 requestAnimationFrame 进行下一次检测
          requestAnimationFrame(checkOpenCV);
        }
        
        // 开始检测
        checkOpenCV();
      });
    },

    createTimeoutPromise: function(promise, timeout) {
      return Promise.race([
        promise,
        new Promise(function(_, reject) {
          setTimeout(function() {
            reject(new Error('操作超时 (' + timeout + 'ms)'));
          }, timeout);
        })
      ]);
    },

    logger: {
      info: function(message) {
        var args = Array.prototype.slice.call(arguments, 1);
        console.log.apply(console, ['[Gemini水印清理] ' + message].concat(args));
      },
      warn: function(message) {
        var args = Array.prototype.slice.call(arguments, 1);
        console.warn.apply(console, ['[Gemini水印清理] ' + message].concat(args));
      },
      error: function(message) {
        var args = Array.prototype.slice.call(arguments, 1);
        console.error.apply(console, ['[Gemini水印清理] ' + message].concat(args));
      }
    }
  };

  // 默认配置
  const defaultConfig = {
    timeout: 30000,
    outputFormat: 'image/png',
    outputQuality: 0.95,
    enabled: true,
    verbose: false,
    interceptorEnabled: true
  };

  let globalConfig = Object.assign({}, defaultConfig);
  let originalFetch;
  let isInterceptorActive = false;

  // 图片处理器
  async function processImageResponse(response, config) {
    config = config || defaultConfig;
    const startTime = performance.now();
    
    try {
      utils.logger.info('开始处理图片响应');
      
      if (!config.enabled) {
        utils.logger.info('图片处理已禁用，返回原始响应');
        return response;
      }

      // 异步等待 OpenCV 就绪
      try {
        await utils.waitForOpenCV(10000); // 10秒超时
      } catch (error) {
        utils.logger.warn('OpenCV 未就绪，返回原始响应:', error.message);
        return response;
      }
      
      if (!window.runWatermarkPipeline) {
        utils.logger.warn('水印处理管道未找到，返回原始响应');
        return response;
      }
      
      const responseClone = response.clone();
      
      const arrayBuffer = await utils.createTimeoutPromise(
        responseClone.arrayBuffer(),
        config.timeout
      );
      
      utils.logger.info('获取到图片数据，大小: ' + arrayBuffer.byteLength + ' 字节');
      
      try {
        const processedResponse = await processImageData(arrayBuffer, response, config);
        const processingTime = performance.now() - startTime;
        utils.logger.info('图片处理完成，耗时: ' + processingTime.toFixed(2) + 'ms');
        return processedResponse;
      } catch (error) {
        utils.logger.warn('图片处理失败，使用原始数据:', error);
        return utils.createResponseFromArrayBuffer(arrayBuffer, response);
      }
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      utils.logger.error('图片处理异常，耗时: ' + processingTime.toFixed(2) + 'ms', error);
      return response;
    }
  }

  async function processImageData(arrayBuffer, originalResponse, config) {
    try {
      utils.logger.info('转换 ArrayBuffer 为 ImageData');
      const imageData = await utils.arrayBufferToImageData(arrayBuffer);
      
      utils.logger.info('图片尺寸: ' + imageData.width + 'x' + imageData.height);
      
      utils.logger.info('调用水印处理管道');
      const cv = window.cv;
      const result = window.runWatermarkPipeline(cv, imageData);
      
      if (!result || !result.result) {
        throw new Error('水印处理管道返回无效结果');
      }
      
      utils.logger.info('水印处理完成，置信度: ' + (result.confidence || 'N/A'));
      
      utils.logger.info('转换处理结果为 Blob');
      const processedBlob = await utils.imageDataToBlob(
        result.result,
        config.outputFormat,
        config.outputQuality
      );
      
      utils.logger.info('处理后图片大小: ' + processedBlob.size + ' 字节');
      
      return utils.createResponseFromBlob(processedBlob, originalResponse);
      
    } catch (error) {
      utils.logger.error('图片数据处理失败:', error);
      throw error;
    }
  }

  // 创建被拦截的 fetch 函数
  function createInterceptedFetch() {
    return async function interceptedFetch(input, init) {
      try {
        const response = await originalFetch.call(this, input, init);
        
        if (utils.shouldProcessImage(input, response)) {
          if (globalConfig.verbose) {
            const urlString = typeof input === 'string' ? input : 
                            input instanceof URL ? input.href :
                            input instanceof Request ? input.url : 'unknown';
            utils.logger.info('检测到图片请求，开始处理:', urlString);
          }
          
          return await processImageResponse(response, globalConfig);
        }
        
        return response;
        
      } catch (error) {
        utils.logger.error('Fetch 拦截器处理错误:', error);
        
        try {
          return await originalFetch.call(this, input, init);
        } catch (originalError) {
          utils.logger.error('原始 fetch 也失败:', originalError);
          throw originalError;
        }
      }
    };
  }

  // 安装拦截器
  function installFetchInterceptor(config) {
    config = config || {};
    
    if (isInterceptorActive) {
      utils.logger.warn('Fetch 拦截器已经安装');
      return;
    }
    
    globalConfig = Object.assign({}, defaultConfig, config);
    
    if (!globalConfig.interceptorEnabled) {
      utils.logger.info('Fetch 拦截器已禁用');
      return;
    }
    
    originalFetch = window.fetch;
    window.fetch = createInterceptedFetch();
    
    isInterceptorActive = true;
    utils.logger.info('Fetch 拦截器安装成功');
  }

  // 卸载拦截器
  function uninstallFetchInterceptor() {
    if (!isInterceptorActive || !originalFetch) {
      utils.logger.warn('Fetch 拦截器未安装或已卸载');
      return;
    }
    
    window.fetch = originalFetch;
    isInterceptorActive = false;
    
    utils.logger.info('Fetch 拦截器已卸载');
  }

  // 更新配置
  function updateInterceptorConfig(config) {
    globalConfig = Object.assign({}, globalConfig, config);
    utils.logger.info('拦截器配置已更新', config);
  }

  // 获取状态
  function getInterceptorStatus() {
    return {
      active: isInterceptorActive,
      config: Object.assign({}, globalConfig)
    };
  }

  // 设置拦截器
  function setupInterceptor() {
    utils.logger.info('初始化 Fetch 拦截器');
    
    document.addEventListener('opencvReady', function() {
      utils.logger.info('OpenCV 已就绪，启用图片处理');
      updateInterceptorConfig({ enabled: true });
    });
    
    installFetchInterceptor({
      verbose: true,
      interceptorEnabled: true
    });
    
    window.addEventListener('beforeunload', function() {
      uninstallFetchInterceptor();
    });
  }

  // 初始化
  function initializeInterceptor() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupInterceptor);
    } else {
      setupInterceptor();
    }
  }

  // 暴露全局接口
  window.geminiWatermarkCleaner = {
    installInterceptor: installFetchInterceptor,
    uninstallInterceptor: uninstallFetchInterceptor,
    updateConfig: updateInterceptorConfig,
    getStatus: getInterceptorStatus
  };

  utils.logger.info('全局接口已暴露: window.geminiWatermarkCleaner');

  // 等待依赖项加载后初始化
  function waitForDependencies() {
    let checkCount = 0;
    const maxChecks = 100; // 最多检查10秒
    
    const checkDependencies = function() {
      checkCount++;
      
      // 检查水印处理管道是否已加载
      if (window.runWatermarkPipeline) {
        utils.logger.info('依赖项已加载，开始初始化拦截器');
        initializeInterceptor();
        return;
      }
      
      if (checkCount >= maxChecks) {
        utils.logger.warn('等待依赖项超时，使用基础配置初始化');
        initializeInterceptor();
        return;
      }
      
      setTimeout(checkDependencies, 100);
    };
    
    checkDependencies();
  }

  // 启动
  waitForDependencies();

})();