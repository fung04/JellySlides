import { ref, reactive } from '../lib/vue.esm-browser.min.js';

export const sharedState = reactive({
  showInfoPanel: ref(true),
  showOptionsMenu: ref(false),
  isLoggedIn: ref(false),
  isLoggingIn: ref(false),
  isSwiperInitialized: ref(false),
  isWebSocketInitialized: ref(false),
  isWebSocketPlaying: ref(false),
});

