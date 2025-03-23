        // const initSwiper = () => {
        //   let currentIndex = 0;
        //   showSwiperContainer.value = true;
        //   showWebSocketContainer.value = false;

        //   swiper.value = new Swiper('.swiper-container', {
        //     init: false,
        //     direction: 'horizontal',
        //     effect: "fade",
        //     fadeEffect: {
        //       crossFade: true
        //     },
        //     loop: true,
        //     speed: 3000,
        //     autoplay: {
        //       delay: 10000,
        //       disableOnInteraction: false,
        //       pauseOnMouseEnter: false,
        //     },
        //     lazy: {
        //       loadPrevNext: true,
        //       loadPrevNextAmount: 2,
        //       loadOnTransitionStart: true
        //     },
        //   });

        //   swiper.value.on('beforeInit', async () => {
        //     const videoIds = await ApiClient.getAllVideoIds();
        //     window.videoIds = videoIds;

        //     const allSlide = document.querySelectorAll('.swiper-slide');

        //     const firstSlide = allSlide[0];
        //     const firstSlideCaption = firstSlide.querySelector('.swiper-slide-caption');
        //     const firstSlideOverview = firstSlide.querySelector('.swiper-slide-overview');
        //     const firstSlideImage = firstSlide.querySelector('img');
        //     firstSlideImage.style.display = 'block';
        //     var firstImageHash = Object.values(videoIds[currentIndex].blurhash)[0];
        //     await applyBackgroundBlurhash(firstImageHash, firstSlide);

        //     const SecondSlide = allSlide[1];
        //     const SecondSlideCaption = SecondSlide.querySelector('.swiper-slide-caption');
        //     const SecondSlideOverview = SecondSlide.querySelector('.swiper-slide-overview');
        //     const SecondSlideImage = SecondSlide.querySelector('img');
        //     SecondSlideImage.style.display = 'block';
        //     var SecondImageHash = Object.values(videoIds[currentIndex + 1].blurhash)[0];
        //     await applyBackgroundBlurhash(SecondImageHash, SecondSlide);

        //     firstSlideImage.src = await ApiClient.getImageUrl(videoIds[currentIndex].id, videoIds[currentIndex].imageType);
        //     firstSlideCaption.innerHTML = videoIds[currentIndex].name;
        //     firstSlideOverview.innerHTML = videoIds[currentIndex].overview;

        //     SecondSlideImage.src = await ApiClient.getImageUrl(videoIds[currentIndex + 1].id, videoIds[currentIndex + 1].imageType);
        //     SecondSlideCaption.innerHTML = videoIds[currentIndex + 1].name;
        //     SecondSlideOverview.innerHTML = videoIds[currentIndex + 1].overview;

        //     const loadingSpinner = document.querySelector('.loading-spinner');
        //     loadingSpinner.style.display = 'none';

        //     swiper.value.autoplay.start();
        //     isSwiperInitialized.value = true;

        //     currentIndex++;
        //   });

        //   swiper.value.on('slideNextTransitionEnd', async () => {
        //     swiper.value.autoplay.pause();
        //     if (currentIndex >= window.videoIds.length) {
        //       currentIndex = 0;
        //     }

        //     const nextSlide = swiper.value.slides[0];
        //     const nextSlideCaption = nextSlide.querySelector('.swiper-slide-caption');
        //     const nextSlideOverview = nextSlide.querySelector('.swiper-slide-overview');
        //     const nextSlideImage = nextSlide.querySelector('img');

        //     var imageHash = Object.values(window.videoIds[currentIndex].blurhash)[0];
        //     await applyBackgroundBlurhash(imageHash, nextSlide);
        //     nextSlideImage.src = await ApiClient.getImageUrl(window.videoIds[currentIndex].id, window.videoIds[currentIndex].imageType);
        //     nextSlideCaption.innerHTML = window.videoIds[currentIndex].name;
        //     nextSlideOverview.innerHTML = window.videoIds[currentIndex].overview;
        //     swiper.value.autoplay.resume();

        //     currentIndex++;
        //   });

        //   async function applyBackgroundBlurhash(hash, imgSlide) {
        //     const MAX_DIMENSION = 32;
        //     const aspectRatio = imgSlide.offsetWidth / imgSlide.offsetHeight;

        //     const width = aspectRatio > 1 ?
        //       MAX_DIMENSION :
        //       Math.round(MAX_DIMENSION * aspectRatio);

        //     const height = aspectRatio > 1 ?
        //       Math.round(MAX_DIMENSION / aspectRatio) :
        //       MAX_DIMENSION;

        //     try {
        //       const imgData = await blurhash.decodePromise(hash, width, height);
        //       const canvas = blurhash.drawImageDataOnNewCanvas(imgData, width, height);
        //       imgSlide.style.backgroundImage = "url(" + canvas.toDataURL() + ")";
        //     } catch (error) {
        //       console.error('Error applying blurhash:', error);
        //     }
        //   }

        //   swiper.value.on('init', () => {
        //     const loadingSpinner = document.querySelector('.loading-spinner');
        //     loadingSpinner.style.display = 'block';

        //     requestWakeLock();

        //     const allSlide = document.querySelectorAll('.swiper-slide');
        //     for (let i = 0; i < allSlide.length; i++) {
        //       const slideImage = allSlide[i].querySelector('img');
        //       slideImage.src = '';
        //       slideImage.style.display = 'none';
        //     }
        //     swiper.value.autoplay.stop();
        //   });

        //   swiper.value.init();

        //   document.getElementById('fullscreenToggle').addEventListener('click', () => {
        //     const container = showSwiperContainer.value ?
        //       document.querySelector('.swiper-container') :
        //       document.querySelector('.swiper-container');

        //     if (!document.fullscreenElement) {
        //       container.requestFullscreen().catch(err => {
        //         console.log(`Error attempting to enable fullscreen: ${err.message}`);
        //       });
        //     } else {
        //       document.exitFullscreen();
        //     }
        //   });

        //   document.addEventListener('keydown', (e) => {
        //     if (e.key === 'ArrowRight') swiper.value.slideNext() && swiper.value.autoplay.start();
        //     if (e.key === 'ArrowLeft') swiper.value.slidePrev();
        //     if (e.key === 'i') console.log(swiper.value.realIndex);
        //   });
        // };
