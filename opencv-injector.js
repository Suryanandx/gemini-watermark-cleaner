function requestUrls() {
  return new Promise((resolve) => {
    let timeoutId = null;
    
    function handleMessage(event) {
      if (event.source !== window) return;
      
      if (event.data.type === 'OPENCV_URLS_RESPONSE') {
        window.removeEventListener('message', handleMessage);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        resolve(event.data.urls);
      }
    }
    
    window.addEventListener('message', handleMessage);
    
    window.postMessage({ type: 'GET_OPENCV_URLS' }, '*');
    
    timeoutId = setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      console.error('Timeout waiting for OpenCV URLs');
      timeoutId = null;
      resolve(null);
    }, 5000);
  });
}

async function initializeOpenCV() {
  console.log('Requesting OpenCV URLs...');
  
  if (window.trustedTypes && window.trustedTypes.createPolicy) {
    try {
      window.trustedTypes.createPolicy('default', {
        createScriptURL: (url) => {
          if (url.startsWith('chrome-extension://') || url.startsWith('blob:')) {
            return url;
          }
          console.warn('Blocked script URL:', url);
          throw new Error('Invalid script URL');
        },
        createScript: (script) => {
          return script;
        },
        createHTML: (html) => {
          return html;
        }
      });
      console.log('Trusted Types default policy created for OpenCV');
    } catch (e) {
      console.warn('Could not create default Trusted Types policy:', e);
    }
  }
  
  const urls = await requestUrls();
  
  if (!urls) {
    console.error('Failed to get OpenCV URLs');
    return;
  }
  
  console.log('OpenCV URLs received:', urls);
  
  window.Module = {
    locateFile: function (path, scriptDirectory) {
      const wasmUrl = urls.wasmBase + path;
      console.log('Loading WASM from:', wasmUrl);
      return wasmUrl;
    },
    preRun: [() => {
      console.log('OpenCV preRun');
    }],
    postRun: [() => {
      console.log('OpenCV postRun');
    }],
    onRuntimeInitialized: function () {
      console.log('OpenCV runtime initialized.');
      if (cv && cv.then) {
        cv.then((cv) => {
          window.cv = cv;
        });
      } else {
        window.cv = cv;
      }
      
      const event = new CustomEvent('opencvReady', { 
        detail: { cv: cv } 
      });
      document.dispatchEvent(event);
    }
  };

  const script = document.createElement('script');
  script.src = urls.opencvJs;
  
  script.async = true;
  script.defer = true;
  script.onload = () => {
    console.log('opencv.js loaded successfully.');
  };
  script.onerror = (err) => {
    console.error('Failed to load opencv.js', err);
  };
  document.head.appendChild(script);
}

initializeOpenCV();
