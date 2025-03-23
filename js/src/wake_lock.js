let wakeLock = null;

async function requestWakeLock() {
    if (document.visibilityState !== 'visible') {
        return; // Don't request if page is not visible
    }
    
    try {
        if (wakeLock) {
            return; // Wake lock already active
        }
        
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('Wake Lock is active');
        
        wakeLock.addEventListener('release', () => {
            console.log('Wake Lock was released');
            wakeLock = null; // Clear the reference
        });

    } catch (err) {
        console.log(`Wake Lock error: ${err.name}, ${err.message}`);
        wakeLock = null;
    }
}

// Only request wake lock when page becomes visible
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});

// Initial request only if page is visible
if (document.visibilityState === 'visible') {
    requestWakeLock();
}

// Re-request when page gains focus
window.addEventListener('focus', async () => {
    if (document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});

// Handle page reload and resume
window.addEventListener('load', async () => {
    if (document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});