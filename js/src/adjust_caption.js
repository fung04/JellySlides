function adjustCaptionSize() {
    const captions = document.querySelectorAll('.swiper-slide-caption');
    
    captions.forEach(caption => {
      let fontSize = 2;
      const container = caption.parentElement;
      caption.style.fontSize = fontSize + 'em';
      
      // Reduce font size until text fits in a single line
      while (caption.scrollWidth > container.clientWidth && fontSize > 0.8) {
        fontSize -= 0.1;
        caption.style.fontSize = fontSize + 'em';
      }
    });
  }
  
  // Call this function on load and resize
  window.addEventListener('load', adjustCaptionSize);
  window.addEventListener('resize', adjustCaptionSize);