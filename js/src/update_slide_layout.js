async function updateSlideLayout(slideElement, videoData) {
    if (!slideElement) return;

    const slideImage = slideElement.querySelector('img');
    const captionWrapper = slideElement.querySelector('.caption-wrapper');

    if (!slideImage || !captionWrapper) return;

    // --- 1. ALWAYS RESET THE STRUCTURE FIRST ---
    // This handles slides being recycled by the slider.
    slideElement.classList.remove('is-portrait', 'is-landscape', 'is-audio');
    const existingCard = slideElement.querySelector('.portrait-card') || slideElement.querySelector('.audio-card');
    if (existingCard) {
        // Move the image and caption back to be direct children of the slide
        slideElement.appendChild(slideImage);
        slideElement.appendChild(captionWrapper);
        // Remove the now-empty card
        existingCard.remove();
    }

    // Reset any inline styles that might conflict
    captionWrapper.style.display = 'block';
    slideImage.style.objectFit = ''; // Reset object-fit

    // --- 2. APPLY NEW LAYOUT BASED ON DATA ---
    if (videoData.type === "Audio") {
        // --- PORTRAIT LOGIC ---
        slideElement.classList.add('is-audio');
        slideImage.style.objectFit = 'contain'; // 'cover' works well with the new card CSS

        // Create the card wrapper that the CSS expects
        const audioCard = document.createElement('div');
        audioCard.className = 'audio-card';

        // Move the image and caption *inside* the new card
        audioCard.appendChild(slideImage);
        

        // Add the completed card to the slide
        slideElement.appendChild(audioCard);

    } else if (videoData.imageType === "Primary") {
        slideElement.classList.add('is-portrait');
        slideImage.style.objectFit = 'cover'; // 'cover' works well with the new card CSS

        // Create the card wrapper that the CSS expects
        const portraitCard = document.createElement('div');
        portraitCard.className = 'portrait-card';

        // Move the image and caption *inside* the new card
        portraitCard.appendChild(slideImage);
        portraitCard.appendChild(captionWrapper);

        // Add the completed card to the slide
        slideElement.appendChild(portraitCard);

    } 
    else {
        // --- LANDSCAPE LOGIC ---
        // The reset step has already ensured the correct DOM structure.
        // We just need to add the class and style.
        slideElement.classList.add('is-landscape');
        slideImage.style.objectFit = 'cover';
    }
}