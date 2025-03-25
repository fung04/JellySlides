import { ref } from '../lib/vue.esm-browser.min.js';
import { sharedState } from './shared-state.js'
import axios from "../lib/axios.js";

export const baseUrl = ref(null);
export const protocol = ref("https");
export const port = ref(443);
export const UserName = ref(null);
export const Password = ref(null);
export const deviceClient = ref('MyClient');
export const deviceName = ref('MyDevice');
export const deviceId = ref(null);
export const applicationVersion = ref(null);
export const accessToken = ref(null);

export const generateDeviceId = () => {
    const userAgent = navigator.userAgent;
    const timestamp = Date.now();
    return btoa(`${userAgent}|${timestamp}`);
};

export const fetchSystemInfo = async () => {
    try {
        const response = await axios.get(`${protocol.value}://${baseUrl.value}:${port.value}/System/Info/Public`);
        applicationVersion.value = response.data.Version;
        localStorage.setItem('systemInfo', JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.error('Failed to fetch system info:', error);
        alert('Could not connect to the server. Please check the address and try again.');
        sharedState.isLoggingIn = false;
    }
};

export const parseServerUrl = async (url) => {
    // Initialize default values
    // let protocol = 'https';
    // let host = '';
    // let port = '';
    
    // Check if the URL already includes a protocol
    if (url.includes('://')) {
      const protocolPart = url.split('://');
      protocol.value = protocolPart[0].toLowerCase();
      url = protocolPart[1];
    }
    
    // Check for port specification
    if (url.includes(':')) {
      const parts = url.split(':');
      baseUrl.value = parts[0];
      // Extract port number (remove any path if present)
      port.value = parts[1].split('/')[0];
    } else {
      baseUrl.value = url.split('/')[0];
      // Assign default ports based on protocol
      port.value = protocol.value === 'https' ? '443' : '80';
    }
    
    console.log(baseUrl.value, protocol.value, port.value);
};
    
export const authenticate = async () => {
    deviceId.value = generateDeviceId();
    const headers = {
        'Authorization': `MediaBrowser Client="${deviceClient.value}", Device="${deviceName.value}", DeviceId="${deviceId.value}", Version="${applicationVersion.value}"`
    };

    try {
        const response = await axios.post(
            `${protocol.value}://${baseUrl.value}:${port.value}/Users/authenticatebyname`,
            {
                Username: UserName.value,
                Pw: Password.value
            },
            { headers: headers }
        );

        const requestHeaders = {
            'Authorization': `MediaBrowser Client="${deviceClient.value}", Device="${deviceName.value}", DeviceId="${deviceId.value}", Version="${applicationVersion.value}", Token="${response.data.AccessToken}"`
        };

        const apiConstantsJson = {
            protocol: protocol.value,
            baseUrl: baseUrl.value,
            port: port.value,
            apiKey: response.data.AccessToken,
            userID: response.data.User.Id,
            fieldItems: "Overview, PremiereDate, CommunityRating, RecursiveItemCount"
        };

        localStorage.setItem("autheticateInfo", JSON.stringify(response.data));
        localStorage.setItem('requestHeaders', JSON.stringify(requestHeaders));
        localStorage.setItem('apiConstant', JSON.stringify(apiConstantsJson));
        localStorage.setItem('deviceId', deviceId.value);

        sharedState.isLoggedIn = true;
        sharedState.isLoggingIn = false;

        // Initialize Swiper and WebSocket after login
        events.emit('login');
        // nextTick(() => {

        //     // initSwiper();
        //     // initWebSocket();
        // });
    } catch (error) {
        console.error('Authentication failed:', error);
        alert('Login failed. Please check your username and password.');
        sharedState.isLoggingIn = false;
        events.emit('logout');

    }
};

export const login = async () => {
    sharedState.isLoggingIn = true;
    await parseServerUrl(baseUrl.value);
    await fetchSystemInfo();
    await authenticate();
};

export const logout = async () => {
    try {
        const requestHeaders = JSON.parse(localStorage.getItem('requestHeaders'));
        const apiConstantsJson = JSON.parse(localStorage.getItem('apiConstant'));

        if (!requestHeaders || !apiConstantsJson) {
            console.warn('Missing authentication data for server logout');
            events.emit('logout');
            // resetState();
            return;
        }

        const headers = {
            'Authorization': requestHeaders.Authorization
        };

        await axios.post(
            `${protocol.value}://${baseUrl.value}:${port.value}/Sessions/Logout`,
            {},
            { headers: headers }
        );

        console.log('Logged out successfully');
    } catch (error) {
        console.error('Logout request failed:', error);
    } finally {
        events.emit('logout');
        // resetState();
    }
};

export const events = {
    listeners: {},
    on(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
    },
    emit(event, ...args) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(callback => callback(...args));
      }
    }
};
