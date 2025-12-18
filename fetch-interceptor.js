(function() {
  'use strict';
  
  console.log('[Fetch Interceptor] Starting Fetch interceptor initialization');
  
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
        console.warn('[Fetch Interceptor] Error checking image request:', error);
        return false;
      }
    },

    arrayBufferToImageData: async function(buffer) {
      let bitmap = null;
      try {
        const blob = new Blob([buffer]);
        bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          if (bitmap) bitmap.close();
          throw new Error('Failed to get OffscreenCanvas 2D context');
        }
        
        ctx.drawImage(bitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
        
        bitmap.close();
        bitmap = null;
        
        return imageData;
      } catch (error) {
        if (bitmap) {
          try {
            bitmap.close();
          } catch (closeError) {
          }
        }
        throw new Error('ArrayBuffer to ImageData conversion failed: ' + error);
      }
    },

    imageDataToBlob: async function(imageData, type, quality) {
      type = type || 'image/png';
      quality = quality || 0.95;
      
      try {
        const canvas = new OffscreenCanvas(imageData.width, imageData.height);
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Failed to get OffscreenCanvas 2D context');
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        const blob = await canvas.convertToBlob({
          type: type,
          quality: quality
        });
        
        return blob;
      } catch (error) {
        throw new Error('ImageData to Blob conversion failed: ' + error);
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
      timeout = timeout || 10000;
      
      return new Promise(function(resolve, reject) {
        const startTime = Date.now();
        
        function checkOpenCV() {
          if (utils.isOpenCVReady()) {
            utils.logger.info('OpenCV detection successful');
            resolve(true);
            return;
          }
          
          const elapsed = Date.now() - startTime;
          if (elapsed >= timeout) {
            utils.logger.warn('OpenCV detection timeout (' + timeout + 'ms)');
            reject(new Error('OpenCV detection timeout'));
            return;
          }
          
          requestAnimationFrame(checkOpenCV);
        }
        
        checkOpenCV();
      });
    },

    waitForWatermarkPipeline: function(timeout) {
      timeout = timeout || 10000;
      
      return new Promise(function(resolve, reject) {
        const startTime = Date.now();
        
        function checkPipeline() {
          if (window.runWatermarkPipeline && typeof window.runWatermarkPipeline === 'function') {
            utils.logger.info('Watermark pipeline detection successful');
            resolve(true);
            return;
          }
          
          const elapsed = Date.now() - startTime;
          if (elapsed >= timeout) {
            utils.logger.warn('Watermark pipeline detection timeout (' + timeout + 'ms)');
            reject(new Error('Watermark pipeline detection timeout'));
            return;
          }
          
          requestAnimationFrame(checkPipeline);
        }
        
        checkPipeline();
      });
    },

    createTimeoutPromise: function(promise, timeout) {
      return Promise.race([
        promise,
        new Promise(function(_, reject) {
          setTimeout(function() {
            reject(new Error('Operation timeout (' + timeout + 'ms)'));
          }, timeout);
        })
      ]);
    },

    logger: {
      info: function(message) {
        var args = Array.prototype.slice.call(arguments, 1);
        console.log.apply(console, ['[Gemini Watermark Cleaner] ' + message].concat(args));
      },
      warn: function(message) {
        var args = Array.prototype.slice.call(arguments, 1);
        console.warn.apply(console, ['[Gemini Watermark Cleaner] ' + message].concat(args));
      },
      error: function(message) {
        var args = Array.prototype.slice.call(arguments, 1);
        console.error.apply(console, ['[Gemini Watermark Cleaner] ' + message].concat(args));
      }
    }
  };

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

  async function processImageResponse(response, config) {
    config = config || defaultConfig;
    const startTime = performance.now();
    
    try {
      utils.logger.info('Starting image response processing');
      
      if (!config.enabled) {
        utils.logger.info('Image processing disabled, returning original response');
        return response;
      }

      try {
        await Promise.all([
          utils.waitForOpenCV(10000),
          utils.waitForWatermarkPipeline(10000)
        ]);
      } catch (error) {
        utils.logger.warn('Dependencies not ready, returning original response:', error.message);
        return response;
      }
      
      let responseClone;
      let arrayBuffer;
      
      try {
        if (response.bodyUsed) {
          utils.logger.warn('Response body already consumed, cannot process');
          return response;
        }
        responseClone = response.clone();
      } catch (cloneError) {
        utils.logger.warn('Cannot clone response, may not be cloneable:', cloneError);
        return response;
      }
      
      try {
        arrayBuffer = await utils.createTimeoutPromise(
          responseClone.arrayBuffer(),
          config.timeout
        );
      } catch (bufferError) {
        utils.logger.error('Failed to get array buffer:', bufferError);
        return response;
      }
      
      utils.logger.info('Image data retrieved, size: ' + arrayBuffer.byteLength + ' bytes');
      
      try {
        const processedResponse = await processImageData(arrayBuffer, response, config);
        const processingTime = performance.now() - startTime;
        utils.logger.info('Image processing completed, time: ' + processingTime.toFixed(2) + 'ms');
        return processedResponse;
      } catch (error) {
        utils.logger.warn('Image processing failed, using original data:', error);
        try {
          return utils.createResponseFromArrayBuffer(arrayBuffer, response);
        } catch (fallbackError) {
          utils.logger.error('Failed to create fallback response:', fallbackError);
          return response;
        }
      }
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      utils.logger.error('Image processing exception, time: ' + processingTime.toFixed(2) + 'ms', error);
      return response;
    }
  }

  async function processImageData(arrayBuffer, originalResponse, config) {
    try {
      utils.logger.info('Converting ArrayBuffer to ImageData');
      const imageData = await utils.arrayBufferToImageData(arrayBuffer);
      
      utils.logger.info('Image dimensions: ' + imageData.width + 'x' + imageData.height);
      
      utils.logger.info('Calling watermark processing pipeline');
      const cv = window.cv;
      const result = window.runWatermarkPipeline(cv, imageData);
      
      if (!result || !result.result) {
        throw new Error('Watermark processing pipeline returned invalid result');
      }
      
      utils.logger.info('Watermark processing completed, confidence: ' + (result.confidence || 'N/A'));
      
      utils.logger.info('Converting processed result to Blob');
      const processedBlob = await utils.imageDataToBlob(
        result.result,
        config.outputFormat,
        config.outputQuality
      );
      
      utils.logger.info('Processed image size: ' + processedBlob.size + ' bytes');
      
      return utils.createResponseFromBlob(processedBlob, originalResponse);
      
    } catch (error) {
      utils.logger.error('Image data processing failed:', error);
      throw error;
    }
  }

  function createInterceptedFetch() {
    return async function interceptedFetch(input, init) {
      try {
        const response = await originalFetch.call(this, input, init);
        
        if (utils.shouldProcessImage(input, response)) {
          if (globalConfig.verbose) {
            const urlString = typeof input === 'string' ? input : 
                            input instanceof URL ? input.href :
                            input instanceof Request ? input.url : 'unknown';
            utils.logger.info('Image request detected, starting processing:', urlString);
          }
          
          return await processImageResponse(response, globalConfig);
        }
        
        return response;
        
      } catch (error) {
        utils.logger.error('Fetch interceptor processing error:', error);
        
        try {
          return await originalFetch.call(this, input, init);
        } catch (originalError) {
          utils.logger.error('Original fetch also failed:', originalError);
          throw originalError;
        }
      }
    };
  }

  function installFetchInterceptor(config) {
    config = config || {};
    
    if (isInterceptorActive) {
      utils.logger.warn('Fetch interceptor already installed');
      return;
    }
    
    if (window.fetch && window.fetch !== originalFetch && originalFetch) {
      utils.logger.warn('Another fetch interceptor detected, uninstalling previous one');
      window.fetch = originalFetch;
    }
    
    globalConfig = Object.assign({}, defaultConfig, config);
    
    if (!globalConfig.interceptorEnabled) {
      utils.logger.info('Fetch interceptor disabled');
      return;
    }
    
    originalFetch = window.fetch;
    window.fetch = createInterceptedFetch();
    
    isInterceptorActive = true;
    utils.logger.info('Fetch interceptor installed successfully');
  }

  function uninstallFetchInterceptor() {
    if (!isInterceptorActive || !originalFetch) {
      utils.logger.warn('Fetch interceptor not installed or already uninstalled');
      return;
    }
    
    window.fetch = originalFetch;
    isInterceptorActive = false;
    
    utils.logger.info('Fetch interceptor uninstalled');
  }

  function updateInterceptorConfig(config) {
    globalConfig = Object.assign({}, globalConfig, config);
    utils.logger.info('Interceptor configuration updated', config);
  }

  function getInterceptorStatus() {
    return {
      active: isInterceptorActive,
      config: Object.assign({}, globalConfig)
    };
  }

  function setupInterceptor() {
    utils.logger.info('Initializing Fetch interceptor');
    
    document.addEventListener('opencvReady', function() {
      utils.logger.info('OpenCV ready, enabling image processing');
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

  function initializeInterceptor() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupInterceptor);
    } else {
      setupInterceptor();
    }
  }

  window.geminiWatermarkCleaner = {
    installInterceptor: installFetchInterceptor,
    uninstallInterceptor: uninstallFetchInterceptor,
    updateConfig: updateInterceptorConfig,
    getStatus: getInterceptorStatus
  };

  utils.logger.info('Global interface exposed: window.geminiWatermarkCleaner');

  function waitForDependencies() {
    let checkCount = 0;
    const maxChecks = 200;
    let opencvReady = false;
    let pipelineReady = false;
    
    const checkDependencies = function() {
      checkCount++;
      
      if (utils.isOpenCVReady()) {
        opencvReady = true;
      }
      
      if (window.runWatermarkPipeline && typeof window.runWatermarkPipeline === 'function') {
        pipelineReady = true;
      }
      
      if (opencvReady && pipelineReady) {
        utils.logger.info('All dependencies loaded, starting interceptor initialization');
        initializeInterceptor();
        return;
      }
      
      if (checkCount >= maxChecks) {
        utils.logger.warn('Dependency wait timeout, initializing with basic configuration');
        initializeInterceptor();
        return;
      }
      
      setTimeout(checkDependencies, 100);
    };
    
    checkDependencies();
  }

  waitForDependencies();

})();
