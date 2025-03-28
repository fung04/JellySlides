import { ref, nextTick } from '../lib/vue.esm-browser.min.js';
import { sharedState } from './shared-state.js'
import { swiper } from '../src/init_swiper.js';

export const wsClient = ref(null);
export const firstData = ref(null);
export const previousDeviceId = ref(null);
export const previousMediaId = ref(null);

export const initWebSocket = () => {
    const apiConstants = JSON.parse(localStorage.getItem('apiConstant') || '{}');
    const deviceId = localStorage.getItem('deviceId');



    if (!apiConstants.apiKey || !apiConstants.baseUrl || !deviceId) {
        console.error('Missing required data for WebSocket connection');
        return;
    }

    wsClient.value = new WebSocketClient({
        serverAddress: apiConstants.baseUrl,
        apiKey: apiConstants.apiKey,
        deviceId: deviceId,
        protocol: apiConstants.protocol || 'wss',
        port: apiConstants.port || 443,
        
        onMessage: (message) => {
            if (sharedState.isSwiperInitialized === true) {

                if (message.MessageType === 'Sessions') {
                    processMessageData(message);
                }
            }
        },
        onConnect: () => {
            wsClient.value.sendMessage("KeepAlive");
            setTimeout(() => {
                wsClient.value.sendMessage("SessionsStart", "0, 1500");
                wsClient.value.sendMessage("ActivityLogEntryStart", "0, 1000");
            }, 500);
            sharedState.isWebSocketInitialized = true;
        },
        onError: (error) => {
            console.error('WebSocket error:', error);
        },
        onClose: (event) => {
            console.log('WebSocket connection closed', event);
        },
        onUnexpectedClose: () => {
            setTimeout(() => {
                if (sharedState.isLoggedIn) {
                    initWebSocket();
                }
            }, 5000);
        }
    });

    wsClient.value.connect();
};

export const processMessageData = (message) => {
  // Function to safely access properties, avoids errors if an object is missing
  const safeAccess = (obj, ...keys) => {
    if (!obj) return undefined;
    return keys.reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
  };

    if (!message || !message.Data || !Array.isArray(message.Data)) {
        console.warn("Invalid message data received:", message);
        return;  // Early exit for invalid data
    }

    // 1. Find item with the same device ID (if applicable)
    if (previousDeviceId.value) {
        for (const data of message.Data) {
            if (data.DeviceId === previousDeviceId.value) {
                console.log(`Found match with previous device ID ${previousDeviceId.value}`);
                firstData.value = data;
                break; // Exit the loop; match found
            }
        }
    }

    // 2. If no device ID match, find a playing item
    if (!firstData.value) {
        for (const data of message.Data) {
            if (safeAccess(data, 'PlayState', 'IsPaused') === false && data.NowPlayingItem) {
                console.log("Found a playing item", data);
                firstData.value = data;
                previousDeviceId.value = data.DeviceId;
                break; // Exit the loop; playing item found
            }
        }
    }

    // 3. No valid data found in the message
    if (!firstData.value) {
      console.warn("No valid playing item found in the message.");
      previousDeviceId.value = null;
      return; // Exit the function, no action needed.
    }

    // 4. Media State Handling
    if (firstData.value?.PlayState) {
        const isPlaying = firstData.value.PlayState.IsPaused === false;
        const MediaInfo = firstData.value.NowPlayingItem || {}; // Default to empty object
        const nowPlayingName = MediaInfo.Name || "Unknown Track";
        const mediaId = MediaInfo.Id;
        const MediaChanged = mediaId && previousMediaId.value !== mediaId;

        console.log(`State: ${MediaChanged ? 'New Media' : 'Same Media'}, Playing: ${isPlaying ? 'Yes' : 'No'}, Previous ID: ${previousMediaId.value || 'None'}`);

        if (MediaChanged) {

            if (isPlaying) {
                const delay = swiper.value.autoplay.timeLeft < 2000 ? swiper.value.autoplay.timeLeft + 500 : 0;
                setTimeout(() => (performTransition(nowPlayingName, MediaInfo)), delay);
            }
            else if (!isPlaying) {

                // Media is paused
                if (!swiper.value.autoplay.running) {
                    console.log("⏸️ Media Paused - starting autoplay");
                    swiper.value.autoplay.start();
                }

                previousMediaId.value = null; // Reset previousMediaId.value when going to pause state
                previousDeviceId.value = null; // Reset previousDeviceId.value when going to pause state
                firstData.value = null; // Reset firstData.value when going to pause state
            }
        }
        else if (!MediaChanged) {

            if (!isPlaying) {
                // Media is paused and no change in media detected
                if (!swiper.value.autoplay.running) {
                    console.log("⏸️ Media Paused - starting autoplay");
                    swiper.value.autoplay.start();
                }

                previousMediaId.value = null; // Reset previousMediaId.value when going to pause state
                previousDeviceId.value = null; // Reset previousDeviceId.value when going to pause state
                firstData.value = null; // Reset firstData.value when going to pause state
            }
        }
            
    } else {
        console.warn("firstData.PlayState is not present:", firstData);
    }

    // --- Local Function: performTransition within processMessageData ---
    async function performTransition(nowPlayingName, MediaInfo) {
        previousMediaId.value = MediaInfo.Id;
        const nextSlideIndex = swiper.value.previousIndex;
        const nextSlide = swiper.value.slides[nextSlideIndex];
        const nextSlideCaption = nextSlide.querySelector('.swiper-slide-caption');
        const nextSlideOverview = nextSlide.querySelector('.swiper-slide-overview');
        const nextSlideImage = nextSlide.querySelector('img');

        try {
                const result = await ApiClient.getImageUrl(MediaInfo.Id);
                const blurhashValue = Object.values(result.blurhashId)[0];
                await applyBackgroundBlurhash(blurhashValue, nextSlide);
                nextSlideImage.src = result.imageUrl;
            } catch (error) {
                console.error('Error fetching image URL:', error.message);
                nextSlideImage.src = 'https://plchldr.co/i/500x500?&bg=1111&fc=ffff'; // Fallback
            }

        nextSlideCaption.innerHTML = nowPlayingName;
        nextSlideOverview.innerHTML = MediaInfo.Album || "Now Playing";
        console.log(`Current index ${swiper.value.activeIndex}, Slide to index ${nextSlideIndex}`);
        if (swiper.value.activeIndex !== nextSlideIndex) {
            swiper.value.slideTo(nextSlideIndex); // Use slideTo for direct transition
        }

        console.log("⏭️ Media changed - updating slide and advancing and stop autoplay");
        swiper.value.autoplay.stop()
    }
}