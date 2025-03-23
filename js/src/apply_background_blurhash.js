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