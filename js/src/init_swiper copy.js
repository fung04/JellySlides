import { ref } from '../lib/vue.esm-browser.min.js';

export const isSwiperInitialized = ref(null);
export const swiper = ref(null);

export const initSwiper = () => {
    // Extract configuration for better maintainability
    const SWIPER_CONFIG = {
        direction: 'horizontal',
        effect: "fade",
        fadeEffect: { crossFade: true },
        loop: true,
        speed: 1000,
        autoplay: {
            delay: 5000,
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
        loadingSpinner: document.querySelector('.loading-spinner'),
        progressBar: createProgressBar(),
        fullscreenToggle: document.getElementById('fullscreenToggle'),
        slides: null // Will be populated after swiper initialization
    };

    // Initialize state
    // showSwiperContainer.value = true;
    // showWebSocketContainer.value = false;

    // Create and insert progress bar
    function createProgressBar() {
        const progressBar = document.createElement('div');
        progressBar.className = 'swiper-progress-bar';
        progressBar.innerHTML = '<div class="swiper-progress-bar-inner"></div>';
        document.querySelector('.swiper-wrapper').appendChild(progressBar);
        return progressBar;
    }

    // Update progress bar based on current index
    function updateProgressBar() {
        if (!videoIds.length) return;
        const progress = (currentIndex % videoIds.length) / videoIds.length * 100;
        const progressInner = domElements.progressBar.querySelector('.swiper-progress-bar-inner');
        progressInner.style.width = `${progress}%`;
    }

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
            }
            await Promise.allSettled(promises);
        } catch (error) {
            console.error('Error preloading images:', error);
            // Continue execution - preloading is not critical
        }
    }

    // Apply blurhash to slide background with better error handling
    async function applyBackgroundBlurhash(hash, slide) {
        if (!hash) {
            console.warn('Missing blurhash, applying fallback background');
            slide.style.backgroundColor = '#333'; // Fallback color
            return;
        }

        const MAX_DIMENSION = 32;
        const aspectRatio = slide.offsetWidth / slide.offsetHeight || 16 / 9; // Fallback aspect ratio

        const width = aspectRatio > 1 ? MAX_DIMENSION : Math.round(MAX_DIMENSION * aspectRatio);
        const height = aspectRatio > 1 ? Math.round(MAX_DIMENSION / aspectRatio) : MAX_DIMENSION;

        try {
            const imgData = await blurhash.decodePromise(hash, width, height);
            const canvas = blurhash.drawImageDataOnNewCanvas(imgData, width, height);
            slide.style.backgroundImage = `url(${canvas.toDataURL()})`;

            // Clean up canvas to avoid memory leaks
            setTimeout(() => {
                canvas.width = 0;
                canvas.height = 0;
            }, 5000);
        } catch (error) {
            console.error('Error applying blurhash:', error);
            slide.style.backgroundColor = '#333'; // Fallback color
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
        try {
            // Show loading indicator
            // if (domElements.loadingSpinner) {
            //     domElements.loadingSpinner.style.display = 'block';
            // }

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
            isSwiperInitialized.value = true;
            currentIndex = 2; // Next index to load

            // Hide loading spinner
            // if (domElements.loadingSpinner) {
            //     domElements.loadingSpinner.style.display = 'none';
            // }

            // Initialize progress bar
            updateProgressBar();

        } catch (error) {
            console.error('Error during swiper initialization:', error);

            // Show error message
            // if (domElements.loadingSpinner) {
            //     domElements.loadingSpinner.style.display = 'none';
            // }

            const errorMsg = document.createElement('div');
            errorMsg.className = 'swiper-error';
            errorMsg.innerHTML = 'Failed to load content. Please check your connection and refresh.';
            domElements.swiperContainer.appendChild(errorMsg);
        }
    });

    // Handle slide transitions with improved logic
    // swiper.value.on('slideNextTransitionStart', () => {
    //     // Pause autoplay during transition to prevent timing issues
    //     swiper.value.autoplay.stop();
    // });

    swiper.value.on('isEnd', async () => {
        try {
            swiper.value.autoplay.stop();

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
            console.log(`Current index: ${swiper.value.activeIndex}, next slide index: ${nextSlideIndex}, real index: ${swiper.value.realIndex}`);
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
            console.log(`Selected video ${videoToShow.name} (attempt ${attemptsToFindUnseen})`);
            // Update next slide
            await updateSlide(nextSlide, videoToShow);

            // Preload next few slides for smoother experience
            const nextPreloadIndex = (currentIndex + 1) % videoIds.length;
            preloadImages(nextPreloadIndex, PRELOAD_COUNT).catch(err =>
                console.warn('Background preloading failed:', err)
            );

            // Update progress indicator
            updateProgressBar();

            // Resume autoplay
            swiper.value.autoplay.start();

            // Increment for next time
            currentIndex = (currentIndex + 1) % videoIds.length;

        } catch (error) {
            console.error('Error during slide transition:', error);
            swiper.value.autoplay.start(); // Ensure slideshow continues despite errors
        }
    });

    swiper.value.on("doubleClick", () =>{
        const container = domElements.swiperContainer;

        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }

    });

    // Initialize event for better cleanup
    swiper.value.on('init', () => {
        // Show loading state
        // if (domElements.loadingSpinner) {
        //     domElements.loadingSpinner.style.display = 'block';
        // }

        // Request wake lock to keep screen on
        requestWakeLock().catch(err => console.warn('Wake lock request failed:', err));

        // Reset all slides
        // const allSlides = document.querySelectorAll('.swiper-slide');
        // for (let i = 0; i < allSlides.length; i++) {
        //     const slideImage = allSlides[i].querySelector('img');
        //     if (slideImage) {
        //         slideImage.src = '';
        //         slideImage.style.display = 'none';
        //     }
        // }

        // Start with autoplay stopped
        swiper.value.autoplay.start();
    });

    // Initialize swiper
    swiper.value.init();

    // Responsive resize handler for better adaptability
    const handleResize = () => {
        // Update swiper dimensions
        swiper.value.update();

        // Adjust blurhash for new dimensions if needed
        const currentSlide = swiper.value.slides[swiper.value.activeIndex];
        const currentVideoId = videoIds[currentIndex - 1];
        if (currentVideoId && currentSlide) {
            const hash = Object.values(currentVideoId.blurhash)[0];
            applyBackgroundBlurhash(hash, currentSlide);
        }
    };

    // Add responsive handling
    // window.addEventListener('resize', handleResize);
    // Add fullscreen functionality
    if (domElements.fullscreenToggle) {
        domElements.fullscreenToggle.addEventListener('click', () => {
            const container = domElements.swiperContainer;

            if (!document.fullscreenElement) {
                container.requestFullscreen().catch(err => {
                    console.log(`Error attempting to enable fullscreen: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        });
    }

    // Add keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
            swiper.value.slideNext();
            swiper.value.autoplay.start();
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
        // Remove event listeners
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);

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
        isSwiperInitialized.value = false;
        console.log('Swiper resources cleaned up');
    };

    window.addEventListener('beforeunload', cleanup);

}
