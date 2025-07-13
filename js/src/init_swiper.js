import { ref } from '../lib/vue.esm-browser.min.js';
import { sharedState } from './shared-state.js'

// export const isSwiperInitialized = ref(null);
export const swiper = ref(null);

export const initSwiper = () => {
    // Extract configuration for better maintainability
    const SWIPER_CONFIG = {
        direction: 'horizontal',
        effect: "fade",
        fadeEffect: { crossFade: true },
        loop: true,
        speed: 3000,
        autoplay: {
            delay: 20000,
            disableOnInteraction: false,
            pauseOnMouseEnter: false,
        },

        lazy: {
            loadPrevNext: true,
            loadPrevNextAmount: 3, // Increased from 2 to preload more slides
            loadOnTransitionStart: true
        }
    };

    // Constants for better readability and configuration
    const PRELOAD_COUNT = 3;
    const CACHE_SIZE = 10;

    // State management variables
    let currentIndex = 0;
    let slideCache = new Map(); // Cache for loaded slides to avoid reloading
    let viewedSlides = new Set(); // Track viewed slides
    let videoIds = [];

    // DOM element cache to avoid repeated queries
    const domElements = {
        swiperContainer: document.querySelector('.swiper-container'),
        slides: null // Will be populated after swiper initialization
    };

    // Preload images function - separated for clarity
    async function preloadImages(startIndex, count) {
        try {
            const promises = [];
            for (let i = 0; i < count; i++) {
                const index = (startIndex + i) % videoIds.length;
                // Skip if already in cache
                if (slideCache.has(videoIds[index].id)) continue;
                // console.log(`Preloading slide ${index + 1} of ${count}`);
                // Create a promise to load image URL
                // const promise = ApiClient.getImageUrl(videoIds[index].id, videoIds[index].imageType)
                //   .then(url => {
                //     return new Promise((resolve, reject) => {
                //       const img = new Image();
                //       img.onload = () => {
                //         // Store in cache when loaded
                //         slideCache.set(videoIds[index].id, {
                //           url,
                //           blurhash: Object.values(videoIds[index].blurhash)[0],
                //           name: videoIds[index].name,
                //           overview: videoIds[index].overview
                //         });
                //         resolve(url);
                //       };
                //       img.onerror = () => reject(new Error(`Failed to load image for ${videoIds[index].id}`));
                //       img.src = url;
                //     });
                //   });
                // promises.push(promise);

                const url = ApiClient.getImageUrl(videoIds[index].id, videoIds[index].imageType);
                const promise = new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        slideCache.set(videoIds[index].id, {
                            url,
                            blurhash: Object.values(videoIds[index].blurhash)[0],
                            name: videoIds[index].name,
                            overview: videoIds[index].overview
                        });
                        resolve(url);
                    };
                    img.onerror = () => reject(new Error(`Failed to load image for ${videoIds[index].id}`));
                    img.src = url;
                });
                promises.push(promise);
            }
            await Promise.allSettled(promises);
        } catch (error) {
            console.error('Error preloading images:', error);
            // Continue execution - preloading is not critical
        }
    }

    // Update slide content with error handling
    async function updateSlide(slide, videoData) {
        if (!slide || !videoData) {
            console.error('Missing slide or video data');
            return;
        }

        try {
            const slideCaption = slide.querySelector('.swiper-slide-caption');
            const slideOverview = slide.querySelector('.swiper-slide-overview');
            const slideImage = slide.querySelector('img');
            const slideElement = slideImage.closest('.swiper-slide');
            console.log(`${videoData.id}, ${videoData.name}, ${videoData.imageType}`);

            // Apply blurhash first for quick display
            const blurhashValue = Object.values(videoData.blurhash)[0];
            await applyBackgroundBlurhash(blurhashValue, slide);

            // Check cache first
            let imageUrl;
            if (slideCache.has(videoData.id)) {
                const cachedData = slideCache.get(videoData.id);
                imageUrl = cachedData.url;
            } else {
                // Load and cache if not available
                imageUrl = await ApiClient.getImageUrl(videoData.id, videoData.imageType);
                slideCache.set(videoData.id, {
                    url: imageUrl,
                    blurhash: blurhashValue,
                    name: videoData.name,
                    overview: videoData.overview
                });
            }

            if (slideElement) {
                await updateSlideLayout(slideElement, videoData);
            }

            // Update slide content
            slideImage.style.display = 'block';
            slideImage.src = imageUrl;
            slideCaption.innerHTML = videoData.name || 'Untitled';
            slideOverview.innerHTML = videoData.overview || '';

            // Track viewed slides
            viewedSlides.add(videoData.id);

            // Manage cache size to prevent memory issues
            if (slideCache.size > CACHE_SIZE) {
                const oldestKey = slideCache.keys().next().value;
                slideCache.delete(oldestKey);
            }
        } catch (error) {
            console.error(`Error updating slide for video ${videoData?.id}:`, error);
            // Apply fallback content
            const slideCaption = slide.querySelector('.swiper-slide-caption');
            const slideOverview = slide.querySelector('.swiper-slide-overview');
            slideCaption.innerHTML = 'Content Unavailable';
            slideOverview.innerHTML = 'Unable to load this content. Please try again later.';
        }
    }

    // Initialize swiper instance with error handling
    try {
        swiper.value = new Swiper('.swiper-container', {
            init: false,
            ...SWIPER_CONFIG
        });
    } catch (error) {
        console.error('Failed to initialize Swiper:', error);
        const errorMsg = document.createElement('div');
        errorMsg.className = 'swiper-error';
        errorMsg.innerHTML = 'Failed to initialize slideshow. Please refresh the page.';
        domElements.swiperContainer.appendChild(errorMsg);
        return; // Exit if we can't initialize Swiper
    }

    // Swiper event handlers with improved error handling
    swiper.value.on('beforeInit', async () => {
        let retryCount = 0;
        const BACKOFF_MAX = 30000; // Maximum backoff of 30 seconds

        async function attemptInitialization() {
            try {
                // Load video data with timeout and error handling
                const dataPromise = ApiClient.getAllVideoIds();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Data loading timeout')), 1000000)
                );
                videoIds = await Promise.race([dataPromise, timeoutPromise]);
                // Handle empty data case
                if (!videoIds || videoIds.length === 0) {
                    throw new Error('No video data available');
                }
                // Store in local scope only, not in window
                window.videoIds = videoIds; // Keep for backward compatibility but will refactor
                // Update DOM element cache after swiper creates slides
                domElements.slides = document.querySelectorAll('.swiper-slide');
                // Initialize first two slides
                if (domElements.slides.length >= 2) {
                    await updateSlide(domElements.slides[0], videoIds[0]);
                    await updateSlide(domElements.slides[1], videoIds[1]);
                }
                // Preload additional slides
                await preloadImages(2, PRELOAD_COUNT - 2);
                // Start autoplay and update UI
                sharedState.isSwiperInitialized = true;
                currentIndex = 2; // Next index to load

                // Clear any existing error message if successful
                const existingError = document.querySelector('.swiper-error');
                if (existingError) {
                    existingError.remove();
                }

            } catch (error) {
                retryCount++;
                console.error(`Error during swiper initialization (attempt ${retryCount}):`, error);

                // Show/update status message
                let statusMsg = document.querySelector('.swiper-error');
                if (!statusMsg) {
                    statusMsg = document.createElement('div');
                    statusMsg.className = 'swiper-error';
                    domElements.swiperContainer.appendChild(statusMsg);
                }
                statusMsg.innerHTML = `Connection issue detected. Retrying... (attempt ${retryCount})`;

                // Implement exponential backoff with a maximum cap
                const backoffTime = Math.min(1000 * Math.pow(1.5, Math.min(retryCount, 10)), BACKOFF_MAX);
                console.log(`Retrying in ${backoffTime / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, backoffTime));

                // Recursive retry
                return attemptInitialization();
            }
        }

        // Start the initialization process with unlimited retry capability
        await attemptInitialization();
    });

    swiper.value.on('slideNextTransitionEnd', async () => {
        try {
            swiper.value.autoplay.pause();

            // Check if we have content
            if (!videoIds || videoIds.length === 0) {
                throw new Error('No video data available');
            }

            // Update current index with wrap-around
            if (currentIndex >= videoIds.length) {
                currentIndex = 0;
            }

            // Find slide that needs updating (typically the one after current)
            const nextSlideIndex = swiper.value.previousIndex
            const nextSlide = swiper.value.slides[nextSlideIndex];

            // Prioritize showing unseen content if available
            let videoToShow = videoIds[currentIndex];
            let attemptsToFindUnseen = 0;

            // Try to find unseen content (but limit attempts to avoid infinite loop)
            while (viewedSlides.has(videoToShow.id) && attemptsToFindUnseen < videoIds.length) {
                currentIndex = (currentIndex + 1) % videoIds.length;
                videoToShow = videoIds[currentIndex];
                attemptsToFindUnseen++;
            }

            // If we've seen everything, reset tracking to show all again
            if (attemptsToFindUnseen >= videoIds.length) {
                viewedSlides.clear();
            }

            // console.log(`Current index: ${swiper.value.activeIndex}, next slide index: ${nextSlideIndex}, real index: ${swiper.value.realIndex}`);
            // console.log(`Selected video ${videoToShow.name} (attempt ${attemptsToFindUnseen})`);

            // Update next slide
            await updateSlide(nextSlide, videoToShow);

            // Preload next few slides for smoother experience
            const nextPreloadIndex = (currentIndex + 1) % videoIds.length;
            preloadImages(nextPreloadIndex, PRELOAD_COUNT).catch(err =>
                console.warn('Background preloading failed:', err)
            );

            // Resume autoplay
            swiper.value.autoplay.resume();

            // Increment for next time
            currentIndex = (currentIndex + 1) % videoIds.length;

        } catch (error) {
            console.error('Error during slide transition:', error);
            swiper.value.autoplay.start(); // Ensure slideshow continues despite errors
        }
    });

    swiper.value.on("doubleClick", () => {
        const container = domElements.swiperContainer;

        if (!document.fullscreenElement) {
            sharedState.showInfoPanel = false;
            container.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
            sharedState.showInfoPanel = true;
        }

    });

    swiper.value.on("resize", () => {
        if (sharedState.isWebSocketPlaying) return; // Dont start autoplay if websocket is playing

        swiper.value.update();
        if (swiper.value.autoplay.paused) {
            swiper.value.autoplay.resume();
        }
    });

    // Initialize event for better cleanup
    swiper.value.on('init', () => {
        // Request wake lock to keep screen on
        requestWakeLock().catch(err => console.warn('Wake lock request failed:', err));

        // Start with autoplay stopped
        swiper.value.autoplay.start();
    });

    // Initialize swiper
    swiper.value.init();

    // Add keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
            swiper.value.slideNext();
            swiper.value.autoplay.start();
            sharedState.isWebSocketPlaying = false; // Continue autoplay and ignore websocket playing
        }
        if (e.key === 'ArrowLeft') swiper.value.slidePrev();
        if (e.key === 'i') console.log(swiper.value.realIndex);
        if (e.key === 'a') console.log(swiper.value.activeIndex);
        if (e.key === 'p') {
            // Toggle play/pause
            if (swiper.value.autoplay.running) {
                swiper.value.autoplay.stop();
            } else {
                swiper.value.autoplay.start();
            }
        }
    });

    // Proper cleanup function for better resource management
    const cleanup = () => {
        // Clear caches
        slideCache.clear();
        viewedSlides.clear();

        // Stop autoplay
        if (swiper.value) {
            swiper.value.autoplay.stop();
        }

        // Release wake lock if held
        if ('wakeLock' in navigator && navigator.wakeLock) {
            try {
                navigator.wakeLock.release();
            } catch (err) {
                console.warn('Error releasing wake lock:', err);
            }
        }

        // Destroy Swiper instance properly
        if (swiper.value && typeof swiper.value.destroy === 'function') {
            swiper.value.destroy(true, true); // true, true: Delete instance and DOM elements
        }

        // Clear any remaining timers
        if (window.swiperTimers) {
            window.swiperTimers.forEach(timer => clearTimeout(timer));
            window.swiperTimers = [];
        }

        // Release image memory
        domElements.slides?.forEach(slide => {
            const img = slide.querySelector('img');
            if (img) {
                img.src = '';
                img.onload = null;
                img.onerror = null;
            }

            // Remove background images
            slide.style.backgroundImage = '';
        });

        // Remove progress bar
        if (domElements.progressBar && domElements.progressBar.parentNode) {
            domElements.progressBar.parentNode.removeChild(domElements.progressBar);
        }

        // Clear global references
        window.videoIds = undefined;

        // Signal that cleanup is complete
        sharedState.isSwiperInitialized = false;
        console.log('Swiper resources cleaned up');
    };

    window.addEventListener('beforeunload', cleanup);

}
