import { ref, nextTick } from '../lib/vue.esm-browser.min.js';
import { sharedState } from './shared-state.js';
import { swiper } from '../src/init_swiper.js';
// Assuming WebSocketClient and ApiClient are imported or globally available
// import { WebSocketClient } from './path/to/websocket-client.js';
// import { ApiClient } from './path/to/api-client.js';
// Assuming applyBackgroundBlurhash is imported or available
// import { applyBackgroundBlurhash } from './path/to/blurhash-utils.js';

// --- State Refs ---
export const wsClient = ref(null);
export const selectedSessionData = ref(null); // Renamed 'firstData' for clarity
export const previousDeviceId = ref(null);
export const previousMediaId = ref(null);
export const mediaEndTimeoutId = ref(null);
export const mediaIdleTimeoutId = ref(null); // Placeholder for media idle timeout
export const userDataChanged = ref(false); // Placeholder for UserDataChanged message handling

// --- Helper Functions ---

/**
 * Safely access nested properties of an object.
 * @param {object} obj - The object to access properties from.
 * @param {...string} keys - The sequence of keys to access.
 * @returns {*} The value at the nested path, or undefined if path is invalid.
 */
const safeAccess = (obj, ...keys) => {
    if (!obj) return undefined;
    return keys.reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
};

/**
 * Clears the media end timeout if it exists.
 */
const clearMediaEndTimeout = () => {
    if (mediaEndTimeoutId.value) {
        clearTimeout(mediaEndTimeoutId.value);
        mediaEndTimeoutId.value = null;
        console.log("Cleared existing media end timeout.");
    }
};

/**
 * Resets the playback state and ensures Swiper autoplay resumes if needed.
 */
const resetPlaybackState = () => {
    console.log("Resetting playback state.");
    clearMediaEndTimeout(); // Clear any pending timeout
    sharedState.isWebSocketPlaying = false;
    previousMediaId.value = null;
    // Keep previousDeviceId to potentially re-select the same device if it becomes active again
    previousDeviceId.value = null; // Consider if this should be reset too
    selectedSessionData.value = null; // Reset selected session data

    // Start Swiper autoplay if it's not already running
    if (swiper.value && !swiper.value.autoplay.running) {
        console.log("Ensuring Swiper autoplay is running after state reset.");
        swiper.value.autoplay.start();
        swiper.value.slideNext();
    }
};

/**
 * Starts the Swiper autoplay if it's not currently running.
 */
const ensureAutoplayRunning = () => {
    if (swiper.value && !swiper.value.autoplay.running) {
        console.log("Starting Swiper autoplay.");
        swiper.value.autoplay.start();
    }
};

/**
 * Stops the Swiper autoplay if it is currently running.
 */
const ensureAutoplayStopped = () => {
    if (swiper.value && swiper.value.autoplay.running) {
        console.log("Stopping Swiper autoplay.");
        swiper.value.autoplay.stop();
    }
};

/**
 * Sets a timeout to automatically reset playback state when media is expected to end.
 * @param {string} mediaId - The ID of the media item the timeout is for.
 * @param {number} mediaRunTimeTicks - Total runtime in ticks.
 * @param {number} mediaPositionTicks - Current position in ticks.
 */
const setMediaEndTimeout = (mediaId, mediaRunTimeTicks, mediaPositionTicks) => {
    clearMediaEndTimeout(); // Clear any previous timeout first

    if (!mediaId || mediaRunTimeTicks <= 0 || !sharedState.isWebSocketPlaying) {
        if (mediaRunTimeTicks <= 0) {
             console.warn(`Cannot set media end timeout for ${mediaId}: RunTimeTicks is 0 or invalid.`);
        }
        return; // Don't set timeout if runtime is invalid or WS isn't controlling
    }

    const remainingTicks = Math.max(0, mediaRunTimeTicks - mediaPositionTicks);
    const remainingTimeMs = remainingTicks / 10000; // Convert Ticks (100ns) to ms
    const bufferMs = 500; // Add a buffer
    const timeoutDuration = remainingTimeMs + bufferMs;

    console.log(`Setting media end timeout for ${mediaId} in ${timeoutDuration.toFixed(0)}ms (remaining: ${remainingTimeMs.toFixed(0)}ms)`);

    mediaEndTimeoutId.value = setTimeout(() => {
        console.log(`⏳ Media end timeout reached for media ID ${mediaId}.`);
        // Check if the media context is still valid for this timeout
        if (previousMediaId.value === mediaId && sharedState.isWebSocketPlaying) {
            console.log("Timeout confirms track end. Resetting state.");
            resetPlaybackState(); // Resets state and handles autoplay
        } else {
            console.log(`Timeout ignored for ${mediaId}. Current media: ${previousMediaId.value}, WS Playing: ${sharedState.isWebSocketPlaying}`);
        }
        mediaEndTimeoutId.value = null; // Clear the stored ID after execution/ignore
    }, timeoutDuration);
};

/**
 * Updates the target Swiper slide with new media info and triggers the transition.
 * @param {object} mediaInfo - The NowPlayingItem object.
 */
const performSlideTransition = async (mediaInfo) => {
    if (!mediaInfo || !mediaInfo.Id) {
        console.error("performSlideTransition called with invalid mediaInfo.");
        return;
    }
    const nowPlayingName = mediaInfo.Name || "Unknown Track";
    const mediaId = mediaInfo.Id;
    const mediaType = mediaInfo.MediaType

    // Update previousMediaId immediately
    previousMediaId.value = mediaId;
    ensureAutoplayStopped(); // Stop autoplay for transition

    if (!swiper.value || swiper.value.slides.length === 0 || typeof swiper.value.previousIndex !== 'number') {
        console.error("Swiper not ready or no slides available for transition.");
        resetPlaybackState(); // Reset state as we can't transition
        return;
    }

    // Target the slide *before* the currently displayed one for the transition effect
    // This assumes Swiper's internal logic moves to the 'activeIndex' and 'previousIndex' updates accordingly.
    // Ensure this index calculation aligns with your desired visual transition.
    const targetSlideIndex = swiper.value.previousIndex;
    const targetSlide = swiper.value.slides[targetSlideIndex];

    if (!targetSlide) {
        console.error(`Cannot find slide at target index ${targetSlideIndex}. Swiper state: active=${swiper.value.activeIndex}, previous=${swiper.value.previousIndex}`);
        resetPlaybackState(); // Reset state as we can't transition
        return;
    }

    const nextSlideCaption = targetSlide.querySelector('.swiper-slide-caption');
    const nextSlideOverview = targetSlide.querySelector('.swiper-slide-overview');
    const nextSlideImage = targetSlide.querySelector('img'); // Assumes 'img' tag exists

    if (!nextSlideCaption || !nextSlideOverview || !nextSlideImage) {
        console.error("One or more required elements (caption, overview, image) not found in the target slide:", targetSlide);
        // Don't necessarily reset state here, maybe just log and skip image/text update
        // resetPlaybackState(); // Consider if a reset is appropriate here
        return; // Stop processing this slide update
    }

    // Fetch and update image/blurhash
    let blurhashValue = null;
    let imageUrl = './static/placeholder.png'; // Default fallback image
    try {
        // Assuming ApiClient is available and configured
        const result = await ApiClient.getImageUrl(mediaId);
        imageUrl = result.imageUrl || imageUrl; // Use fetched URL or fallback
        if (result.blurhashId && Object.values(result.blurhashId).length > 0) {
            blurhashValue = Object.values(result.blurhashId)[0];
            console.log(mediaInfo)
            
            if (targetSlide) {
                targetSlide.classList.remove('is-portrait', 'is-landscape');
                if (mediaType === "Audio") {
                    console.log('Primary image type detected, applying portrait style');
                    targetSlide.classList.add('is-portrait');
                    nextSlideImage.style.objectFit = 'contain'; // Usually best for portrait
                } else {
                    targetSlide.classList.add('is-landscape');
                    // Apply your landscape object-fit rule
                    nextSlideImage.style.objectFit = 'cover'; // Or your specific logic
                }
                nextSlideImage.style.display = 'block';
            }
        }

        // Apply blurhash background *before* loading the main image
        // Assuming applyBackgroundBlurhash handles null/undefined gracefully
        if (typeof applyBackgroundBlurhash === 'function') {
             await applyBackgroundBlurhash(blurhashValue, targetSlide);
        } else if (blurhashValue) {
            console.warn("applyBackgroundBlurhash function not available.");
            // Basic fallback: Set background color or leave as is
             targetSlide.style.backgroundImage = ''; // Clear previous
        } else {
             targetSlide.style.backgroundImage = ''; // Clear previous
        }

        nextSlideImage.src = imageUrl; // Set image source

    } catch (error) {
        console.error(`Error fetching/processing image for media ${mediaId}:`, error);
        // Use fallback image src (already set by default)
        nextSlideImage.src = imageUrl; // Ensure fallback is set
         // Optionally clear blurhash on error too
         if (targetSlide) targetSlide.style.backgroundImage = '';
    }

    // Update text content
    nextSlideCaption.innerHTML = nowPlayingName;
    nextSlideOverview.innerHTML = mediaInfo.Album || mediaInfo.Overview // Use Album or default text

    // Perform the slide transition if needed
    console.log(`Current index ${swiper.value.activeIndex}, preparing to slide to index ${targetSlideIndex} for media ${mediaId}`);
    if (swiper.value.activeIndex !== targetSlideIndex) {
        console.log(`⏭️ Media changed - sliding to index ${targetSlideIndex}.`);
        swiper.value.slideTo(targetSlideIndex); // Use slideTo for direct transition
    } else {
        console.log("⏭️ Media changed - updating current slide content (index did not change).");
    }

    // Ensure autoplay remains stopped after initiating the slide or updating content
    ensureAutoplayStopped();
};


// --- WebSocket Initialization ---
export const initWebSocket = () => {
    const apiConstants = JSON.parse(localStorage.getItem('apiConstant') || '{}');
    const deviceId = localStorage.getItem('deviceId'); // Local device ID for WebSocket auth

    if (!apiConstants.apiKey || !apiConstants.baseUrl || !deviceId) {
        console.error('Missing required data for WebSocket connection: apiKey, baseUrl, or deviceId');
        return;
    }

    // Cleanup previous connection if any
    if (wsClient.value && typeof wsClient.value.close === 'function') {
        wsClient.value.close();
    }

    // Assuming WebSocketClient is a class handling the connection details
    wsClient.value = new WebSocketClient({
        serverAddress: apiConstants.baseUrl,
        apiKey: apiConstants.apiKey,
        deviceId: deviceId,
        protocol: apiConstants.protocol || 'wss',
        port: apiConstants.port || 443,

        onMessage: (message) => {
            // Process only relevant message types and only if Swiper is ready
            if (sharedState.isSwiperInitialized && (message.MessageType === 'Sessions')) {
                 processMessageData(message);
            } else if (!sharedState.isSwiperInitialized) {
                 console.log("WebSocket message received, but Swiper not initialized yet. Ignoring.");
            }
        },
        onConnect: () => {
            console.log("WebSocket connected.");
            // Send initial messages after a short delay
            wsClient.value?.sendMessage("KeepAlive"); // Use optional chaining
            setTimeout(() => {
                 wsClient.value?.sendMessage("SessionsStart", "0, 1500");
                 wsClient.value?.sendMessage("ActivityLogEntryStart", "0, 1000");
            }, 500);
            sharedState.isWebSocketInitialized = true;
        },
        onError: (error) => {
            console.error('WebSocket error:', error);
            sharedState.isWebSocketInitialized = false; // Reflect connection state
        },
        onClose: (event) => {
            console.log('WebSocket connection closed:', event);
            sharedState.isWebSocketInitialized = false;
             clearMediaEndTimeout(); // Ensure timeout is cleared on close
            // Optionally reset playback state if desired on any close
            // resetPlaybackState();
        },
        onUnexpectedClose: () => {
            console.log('WebSocket connection closed unexpectedly. Attempting reconnect in 5s...');
            sharedState.isWebSocketInitialized = false;
             clearMediaEndTimeout(); // Ensure timeout is cleared on unexpected close
            // Attempt to reconnect only if the user is still logged in
            setTimeout(() => {
                if (sharedState.isLoggedIn) {
                    initWebSocket();
                } else {
                     console.log("User not logged in, skipping WebSocket reconnect.");
                }
            }, 5000); // 5-second delay before attempting reconnect
        }
    });

    wsClient.value.connect();
};

// --- Message Processing Logic ---
export const processMessageData = (message) => {
    // 1. Handle only 'Sessions' messages for playback sync
    if (message.MessageType !== 'Sessions') {
        return;
    }

    // 2. Validate Session Data
    if (!message.Data || !Array.isArray(message.Data)) {
        console.warn("Received 'Sessions' message with invalid or missing Data:", message);
        // If WS was playing, reset state as we lost valid session info
        if (sharedState.isWebSocketPlaying) {
             resetPlaybackState();
        }
        return;
    }

    // 3. Select Relevant Session Data ('selectedSessionData')
    let potentialData = null;
    // Priority 1: Find session matching the previously tracked device ID
    if (previousDeviceId.value) {
        potentialData = message.Data.find(data => data.DeviceId === previousDeviceId.value);
         // if (potentialData) console.log(`Found session matching previous device ID: ${previousDeviceId.value}`);
    }

    // Priority 2: If no match on previous device, find any *actively playing* session
    if (!potentialData) {
        potentialData = message.Data.find(data =>
            safeAccess(data, 'PlayState', 'IsPaused') === false && data.NowPlayingItem
        );
         // if (potentialData) console.log(`Found an actively playing session on device ID: ${potentialData.DeviceId}`);
    }

    // Update selectedSessionData.value
    selectedSessionData.value = potentialData;

    // 5. Process the Selected Session Data
    const currentData = selectedSessionData.value;


    if (currentData?.PlayState && currentData?.NowPlayingItem) {
        const playState = currentData.PlayState;
        const mediaInfo = currentData.NowPlayingItem;
        const currentDeviceId = currentData.DeviceId; // Device ID of the selected session
        previousDeviceId.value = currentDeviceId;

        // Extract key playback details
        const isPlaying = playState.IsPaused === false;
        const mediaId = mediaInfo.Id; 
        const mediaRunTimeTicks = mediaInfo.RunTimeTicks; // Already checked for existence
        const mediaPositionTicks = playState.PositionTicks ?? 0; // Default to 0 if null/undefined
        const mediaChanged = previousMediaId.value !== mediaId;

        // console.log(`Processing Media: ID=${mediaId}, State: ${mediaChanged ? 'New' : 'Same'}, Playing: ${isPlaying}, PosTicks: ${mediaPositionTicks}, RuntimeTicks: ${mediaRunTimeTicks}, PrevID: ${previousMediaId.value || 'None'}, DeviceID: ${currentDeviceId}`);

        // --- Playback Logic ---

        // A. Check for immediate track end based on position vs runtime
        //    (Handles cases where playback might have ended between messages)
        if (isPlaying && mediaRunTimeTicks > 0 && mediaPositionTicks >= mediaRunTimeTicks) {
            console.log(`▶️ Media position (${mediaPositionTicks}) reached/exceeded runtime (${mediaRunTimeTicks}). Assuming track ended.`);
            resetPlaybackState(); // Reset state, includes clearing timeout and starting autoplay
            return; // Stop further processing for this message
        }

        // B. Handle Media Change
        if (mediaChanged) {
            console.log(`Media changed to: ${mediaInfo.Name || 'Unknown'} (ID: ${mediaId})`);
            clearMediaEndTimeout(); // Clear timeout from the *previous* track

            if (isPlaying) {
                // New track is playing: Update state, set new timeout, perform transition
                sharedState.isWebSocketPlaying = true;
                setMediaEndTimeout(mediaId, mediaRunTimeTicks, mediaPositionTicks);

                // Perform slide transition (potentially with delay to sync with Swiper cycle)
                // Adjust delay logic as needed for your UI/UX preference
                const delay = (swiper.value?.autoplay?.timeLeft ?? 0) < 2000 ? (swiper.value.autoplay.timeLeft + 500) : 0;
                console.log(`Performing transition for new media with delay: ${delay}ms`);
                setTimeout(() => performSlideTransition(mediaInfo), delay);
                // performSlideTransition updates previousMediaId internally *after* potential async ops
                // ensureAutoplayStopped is called within performSlideTransition

            } else {
                // New track is paused: Reset state, ensure autoplay runs
                console.log("Media changed but is paused.");
                resetPlaybackState();
            }
            // No 'return' here if !isPlaying, allow fall-through to potentially update state if needed?
            // Re-evaluation: If media changed and is paused, resetPlaybackState handles everything. Should return.
             // Added return for clarity: if media changed, action is taken in the branches above.

        } else { // C. Handle State Update for the *Same* Media
            // console.log("Media has not changed.");
            if (isPlaying) {
                // Same media, still playing: Ensure WS controls state, check timeout
                if (!sharedState.isWebSocketPlaying) {
                    clearTimeout(mediaIdleTimeoutId.value); // Clear idle timeout if it was set
                    console.log("Playback resumed or detected while WS wasn't marked as playing. Taking control.");
                    sharedState.isWebSocketPlaying = true; // Mark WS as controlling
                }
                ensureAutoplayStopped(); // Ensure Swiper doesn't interfere

                // If somehow a timeout wasn't set (e.g., initial load), set it now.
                if (!mediaEndTimeoutId.value) {
                    console.log("Detected playing state for current media without an active end timeout. Setting one now.");
                    setMediaEndTimeout(mediaId, mediaRunTimeTicks, mediaPositionTicks);
                }
                // Update previousMediaId (might be redundant, but safe)
                previousMediaId.value = mediaId;

            } else {
                // Same media, but now paused: Reset state, ensure autoplay runs
                if (sharedState.isWebSocketPlaying) { // Only log/reset if WS *was* controlling
                    console.log("⏸️ Media Paused (no change). Resetting state.");
                    resetPlaybackState();
                } else {
                    // If WS wasn't controlling playback, simply ensure autoplay is running
                    ensureAutoplayRunning();
                }
            }
        }
    }
    else {
        // 4. Handle Invalid Session Data (e.g., no PlayState or NowPlayingItem)
        if (sharedState.isWebSocketPlaying) {
            console.warn("Received session data without valid PlayState or NowPlayingItem:", currentData);
            sharedState.isWebSocketPlaying = false; // Reset playback state
            previousDeviceId.value = null; // Reset device ID to trigger new session search

            // Set a timeout to handle idle state (e.g., no media playing)
            mediaIdleTimeoutId.value = setTimeout(() => {
                console.warn("Media idle timeout reached. Starting autoplay.");
                resetPlaybackState(); // Reset state and start autoplay
            }, 30000);

        }
        return; // Exit if data is invalid
    }
};