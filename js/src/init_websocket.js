import { ref, nextTick } from '../lib/vue.esm-browser.min.js';
import { sharedState } from './shared-state.js'
import { swiper } from '../src/init_swiper.js';

export const wsClient = ref(null);

export const initWebSocket = () => {
    const apiConstants = JSON.parse(localStorage.getItem('apiConstant') || '{}');
    const deviceId = localStorage.getItem('deviceId');
    let previousMediaId = null;
    let previousDeviceId = null;
    let firstData = null;


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

        // Add these at the component level (outside the handler)
        onMessage: (message) => {
            if (sharedState.isSwiperInitialized === true) {
                
                if (message.MessageType === 'Sessions') {
                    // const firstData = message.Data[0];
                    // First, try to find an item with the same device ID as previous
                    if (previousDeviceId) {
                        for (const data of message.Data) {
                            if (data.DeviceId === previousDeviceId) {
                                console.log(`Found match with previous device ID ${previousDeviceId}`);
                                firstData = data;
                                break; // Found a match with the previous device ID and not paused
                            }
                            else {
                                firstData = null; // Where stop playing
                                previousDeviceId = null; // Reset previousDeviceId
                            }
                        }
                    }
                    // If no match found with previous device ID, take the first item with PlayState not paused
                    else if (!firstData) {
                        for (const data of message.Data) {
                            if (data?.PlayState && data.PlayState.IsPaused === false && data.NowPlayingItem) {
                                swiper.value.autoplay.stop();

                                firstData = data;
                                console.log(data)
                                previousDeviceId = data.DeviceId; // Update the previousDeviceId
                                break;
                            }
                            else {
                                // firstData = null; // Where stop playing
                                previousDeviceId = null; // Reset previousDeviceId

                            }   
                        }
                    }

                    // Check if we have position data and a valid PlayState
                    if (firstData?.PlayState) {
                        const isPlaying = firstData.PlayState.IsPaused === false;
                        const MediaInfo = firstData.NowPlayingItem || {};
                        const nowPlayingName = MediaInfo.Name || "Unknown Track";

                        nextTick(() => {
                            
                            // Determine if Media has changed
                            const MediaChanged = MediaInfo.Id && previousMediaId  !== MediaInfo.Id;
                            
                            // Log the current state for debugging
                            console.log(`State: ${MediaChanged ? 'New Media' : 'Same Media'}, Playing: ${isPlaying ? 'Yes' : 'No'}, Previous ID: ${previousMediaId || 'None'}`);
                            
                            if (MediaChanged) {
                                
                                if (isPlaying) {
                                    // Get the current autoplay time left
                                    const timeLeft = swiper.value.autoplay.timeLeft;
                                    console.log("Current autoplay time left:", timeLeft);
                                    
                                    // If time left is less than 2000ms (2 seconds), wait before proceeding
                                    if (timeLeft && timeLeft < 2000) {
                                        console.log("Time left less than 2 seconds, waiting...");
                                        // Use setTimeout to delay the transition
                                        setTimeout(() => {
                                            performTransition();
                                        }, 2000);
                                    } else {
                                        // Proceed immediately with the transition
                                        performTransition();
                                    }
                                    
                                    function performTransition() {
                                        swiper.value.autoplay.stop();
                                        previousMediaId = MediaInfo.Id;
                                        const nextSlideIndex = swiper.value.previousIndex;
                                        const nextSlide = swiper.value.slides[nextSlideIndex];
                                        const nextSlideCaption = nextSlide.querySelector('.swiper-slide-caption');
                                        const nextSlideOverview = nextSlide.querySelector('.swiper-slide-overview');
                                        const nextSlideImage = nextSlide.querySelector('img');
                                        
                                        // Fetch and apply the image
                                        ApiClient.getImageUrl(MediaInfo.Id)
                                            .then(async result => {
                                                console.log(result);
                                                const blurhashValue = Object.values(result.blurhashId)[0];
                                                await applyBackgroundBlurhash(blurhashValue, nextSlide);
                                                nextSlideImage.src = result.imageUrl;
                                            }).catch(error => {
                                                console.error('Error fetching image URL:', error.message);
                                                // Fallback to the placeholder image if there's an error
                                                nextSlideImage.src = 'https://plchldr.co/i/500x500?&bg=1111&fc=ffff';
                                            });
                                            
                                        nextSlideCaption.innerHTML = nowPlayingName;
                                        nextSlideOverview.innerHTML = MediaInfo.Album || "Now Playing";
                                        
                                        console.log(`Current index ${swiper.value.activeIndex}, Slide to index ${nextSlideIndex}`);
                                        
                                        if (swiper.value.activeIndex !== nextSlideIndex) {
                                            swiper.value.slideNext();
                                        }
                                        
                                        console.log("⏭️ Media changed - updating slide and advancing and stop autoplay");
                                        swiper.value.autoplay.stop();
                                    }
                                }
                                else if (!isPlaying)
                                {
                                    if (!swiper.value.autoplay.running) {
                                        previousMediaId = null
                                        firstData = null

                                        console.log("⏸️ Media Pause - staring autoplay")
                                        swiper.value.autoplay.start();

                                    }
                                }
                            } 
                            else if (!MediaChanged) {

                                if (!isPlaying)
                                {
                                    if (!swiper.value.autoplay.running) {
                                        previousMediaId = null
                                        firstData = null
                                        
                                        console.log("⏸️ Current Media Pause - staring autoplay")
                                        console.log(`Current index ${swiper.value.realIndex}, Slide to index ${(swiper.value.activeIndex + 1) % swiper.value.slides.length}`)

                                        swiper.value.autoplay.start();
                                    }
                                }

                            }

                        });
                            
                    }
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
