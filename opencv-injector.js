// OpenCV injection script that runs in the page context
// This script requests URLs from the content script via postMessage

function requestUrls() {
  return new Promise((resolve) => {
    let timeoutId = null;
    
    // Listen for the response
    function handleMessage(event) {
      if (event.source !== window) return;
      
      if (event.data.type === 'OPENCV_URLS_RESPONSE') {
        // Clean up
        window.removeEventListener('message', handleMessage);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        resolve(event.data.urls);
      }
    }
    
    window.addEventListener('message', handleMessage);
    
    // Request the URLs
    window.postMessage({ type: 'GET_OPENCV_URLS' }, '*');
    
    // Fallback timeout after 5 seconds
    timeoutId = setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      console.error('Timeout waiting for OpenCV URLs');
      timeoutId = null;
      resolve(null);
    }, 5000);
  });
}

// Main initialization function
async function initializeOpenCV() {
  console.log('Requesting OpenCV URLs...');
  
  // Set up Trusted Types policy first, before anything else
  if (window.trustedTypes && window.trustedTypes.createPolicy) {
    try {
      // Create a default policy for OpenCV to use
      window.trustedTypes.createPolicy('default', {
        createScriptURL: (url) => {
          // Allow chrome-extension URLs and blob URLs (OpenCV might use them)
          if (url.startsWith('chrome-extension://') || url.startsWith('blob:')) {
            return url;
          }
          console.warn('Blocked script URL:', url);
          throw new Error('Invalid script URL');
        },
        createScript: (script) => {
          // Allow scripts (OpenCV might need to create scripts dynamically)
          return script;
        },
        createHTML: (html) => {
          // Allow HTML creation
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
  
  // Configure the Module object before loading opencv.js
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
      
      // Dispatch a custom event to notify that OpenCV is ready
      const event = new CustomEvent('opencvReady', { 
        detail: { cv: cv } 
      });
      document.dispatchEvent(event);
    }
  };

  // Load the main opencv.js script
  const script = document.createElement('script');
  script.src = urls.opencvJs; // The default policy will handle this
  
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

// Start initialization
initializeOpenCV();
