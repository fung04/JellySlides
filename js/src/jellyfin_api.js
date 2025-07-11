const ImageType = {
    backdrop: 'Backdrop',
    primary: 'Primary',
    thumbnail: 'Thumb',
};

const VideoType = {
    movie: 'Movie',
    series: 'Series',
    season: 'Season',
    audio: 'Audio',
    episode: 'Episode',
    boxset: 'BoxSet',
};

class ApiConstant {
    static baseUrl = '';
    static protocol = 'https'
    static port = 443;
    static apiKey = '';
    static userID = '';
    static fieldItems = "Overview, PremiereDate, CommunityRating, RecursiveItemCount";

    static loadFromJson(json) {
        this.baseUrl = json.baseUrl || '';
        this.port = json.port || 443;
        this.protocol = json.protocol || 'https';
        this.apiKey = json.apiKey || '';
        this.userID = json.userID || '';
        this.fieldItems = json.fieldItems || "Overview, PremiereDate, CommunityRating, RecursiveItemCount";

    }
}

class ApiClient {
    static getImageUrl(videoId, imageType) {
        if (imageType) {
            return `${ApiConstant.protocol}://${ApiConstant.baseUrl}:${ApiConstant.port}/Items/${videoId}/Images/${imageType}/?quality=100&fillHeight=720&fillWidth=1280`;
        } else {
            return ApiClient._getVideoDetails(videoId).then(details => {
                const availableImageType = details.ImageTags ? Object.keys(details.ImageTags)[0] : null;
                if (!availableImageType) {
                    throw new Error('No available image type for the video');
                }
                const imageUrl = `${ApiConstant.protocol}://${ApiConstant.baseUrl}:${ApiConstant.port}/Items/${videoId}/Images/${availableImageType}/?quality=50&fillHeight=720&fillWidth=1280`;
                const blurhashId = details.ImageBlurHashes ? details.ImageBlurHashes[availableImageType] : null;
                return { imageUrl, blurhashId };
            });
        }
    }
    
    static async _getVideoDetails(videoId) {
        const url = `${ApiConstant.protocol}://${ApiConstant.baseUrl}:${ApiConstant.port}/Items/${videoId}?api_key=${ApiConstant.apiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to get video details');
        }
        return response.json();
    }

    static async _getUserId() {
        const jsopApiConstant = JSON.parse(localStorage.getItem('apiConstant'));
        if (jsopApiConstant) {
            ApiConstant.loadFromJson(jsopApiConstant);

            return ApiConstant.userID;
        }
        else {
            ApiConstant.baseUrl = localStorage.getItem("base-url");
            ApiConstant.apiKey = localStorage.getItem("api-key");
            
            const url = new URL(`${ApiConstant.protocol}://${ApiConstant.baseUrl}:${ApiConstant.port}/Users`);
            url.searchParams.append('api_key', ApiConstant.apiKey);
            const response = await fetch(url);
            if (response.ok) {
                const users = await response.json();
                console.log(users);
                return users[0]['Id'];
            } else {
                throw new Error('Failed to get user id');
            }
        }
    }
    
    static async getVideoIds({ videoType, imageType, userId }) {
        userId = userId || await ApiClient._getUserId();
        const url = new URL(`${ApiConstant.protocol}://${ApiConstant.baseUrl}:${ApiConstant.port}/Users/${userId}/Items`);
        url.searchParams.append('IncludeItemTypes', videoType);
        url.searchParams.append('Recursive', 'true');
        url.searchParams.append('fields', ApiConstant.fieldItems);
        url.searchParams.append('api_key', ApiConstant.apiKey);
      
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to get video ids');
        }
      
        const jsonData = await response.json();
        const hashtype = imageType === ImageType.backdrop ? 'Backdrop' : imageType === ImageType.thumbnail ? 'Thumb' : 'Primary';
    
        if (videoType ===  VideoType.boxset) { // || videoType ===  VideoType.audio 
            const parentIds = jsonData['Items'].map(item => ({ id: item['Id'] }));
    
            // Fetch all child items concurrently
            const childResults = await Promise.all(parentIds.map(parentId => 
                ApiClient.fetchAndProcessChildItems({ 
                    parentId, 
                    userId, 
                    videoType, 
                    imageType, 
                    hashtype,
                    ApiConstant 
                })));
    
            // Flatten the results
            const combinedVideoIds = childResults.flat();
    
            return combinedVideoIds;
        }

        if (videoType === VideoType.audio) {
            let processedItems = [];
            const uniqueItems = {};
            jsonData['Items'].forEach(item => {
                uniqueItems[item['Album'] ? item['Album'] : item['AlbumId']] = item;
            });
            // album should be alway use AlbumId
            processedItems = Object.values(uniqueItems)
                .filter(item => item['ImageTags']?.["Primary"] || (item['BackdropImageTags'] && item['ImageBlurHashes'][hashtype]))
                .map(item => ({
                    id: (item['ImageTags']?.["Primary"] ||
                        (item['BackdropImageTags'] && item['BackdropImageTags'].length > 0))
                        ? item['Id']
                        : item['AlbumId'],
                    name: item['Album'],
                    type: item['Type'],
                    overview: item['Overview'] ? item['Overview'] : '',
                    blurhash: item['ImageBlurHashes'][hashtype],
                    imageType: imageType,
            }));

            console.log(processedItems)

            return processedItems;
        } 
        else {
            // Original code for non-series/boxset items
            // 1. Filter the items first
            const filteredItems = jsonData['Items'].filter(item =>
                // Ensure ImageTags and the specific ImageBlurHashes exist
                item['ImageTags'] && item['ImageBlurHashes'] && item['ImageBlurHashes'][hashtype]
            );

            // 2. Map the filtered items with the new conditional logic for 'name'
            const videoIds = filteredItems.map(item => {
                let calculatedName = ''; // Initialize a variable for the name

                if (videoType === VideoType.season) {
                    // Ensure item['Name'] exists before checking its content
                    const itemNameLower = item['Name'] ? item['Name'].toLowerCase() : '';
                    // Check if the item name contains "season" or "special" (case-insensitive)
                    if (itemNameLower.includes('season') || itemNameLower.includes('special')) {
                        // If true, use SeriesName (provide a fallback if SeriesName might be missing)
                        calculatedName = item['SeriesName'] || '';
                    } else {
                        // If false, use the item's Name
                        calculatedName = item['Name'] || '';
                    }
                    // Note: The original code appended SeriesName with a newline.
                    // If you still want that behavior *sometimes*, adjust the logic here.
                    // For example, if you wanted Name + SeriesName ONLY when Name doesn't contain season/special:
                    // else {
                    //     calculatedName = (item['Name'] || '') + "\n" + (item['SeriesName'] || '');
                    // }
                    // Based on your prompt, it seems you want *either* SeriesName *or* Name, not concatenation.

                } else {
                    // If not a season, use the item's Name (provide a fallback)
                    calculatedName = item['Name'] || '';
                }

                // 3. Construct the final object for the map
                return {
                    id: item['Id'],
                    name: calculatedName, // Use the conditionally determined name
                    overview: item['Overview'] ? item['Overview'] : '', // Keep existing overview logic
                    type: item['Type'],
                    blurhash: item['ImageBlurHashes'][hashtype],
                    imageType: imageType,
                };
            });

            return videoIds
        }     
            
    }

    static async fetchAndProcessChildItems({ parentId, userId, videoType, imageType, hashtype}) {
        const childUrl = new URL(`${ApiConstant.protocol}://${ApiConstant.baseUrl}:${ApiConstant.port}/Users/${userId}/Items`);
        childUrl.searchParams.append('ParentId', parentId.id);
        childUrl.searchParams.append('api_key', ApiConstant.apiKey);
        childUrl.searchParams.append('fields', ApiConstant.fieldItems);
    
        const childResponse = await fetch(childUrl);
        if (!childResponse.ok) {
            throw new Error('Failed to get child video ids');
        }
    
        const childJsonData = await childResponse.json();
    
    let processedItems = [];

        if (videoType === VideoType.audio) {
            const uniqueItems = {};
            childJsonData['Items'].forEach(item => {
                uniqueItems[item['Album'] ? item['Album'] : item['AlbumId']] = item;
            });
            // album should be alway use AlbumId
            processedItems = Object.values(uniqueItems)
                .filter(item => item['ImageTags']?.["Primary"] || (item['BackdropImageTags'] && item['ImageBlurHashes'][hashtype]))
                .map(item => ({
                    id: (item['ImageTags']?.["Primary"] ||
                        (item['BackdropImageTags'] && item['BackdropImageTags'].length > 0))
                        ? item['Id']
                        : item['AlbumId'],
                    name: item['Album'],
                    type: item['Type'],
                    overview: item['Overview'] ? item['Overview'] : '',
                    blurhash: item['ImageBlurHashes'][hashtype],
                    imageType: imageType,
                }));
        } else if (videoType === VideoType.boxset) {
            processedItems = childJsonData['Items']
                .filter(item => item['ImageTags']?.["Primary"] || (item['BackdropImageTags'] && item['ImageBlurHashes'][hashtype]))
                .map(item => ({
                    id: (item['ImageTags']?.["Primary"] ||
                        (item['BackdropImageTags'] && item['BackdropImageTags'].length > 0))
                        ? item['Id']
                        : item['AlbumId'],
                    name: item['Name'],
                    type: item['Type'],
                    overview: item['Overview'] ? item['Overview'] : '',
                    blurhash: item['ImageBlurHashes'][hashtype],
                    imageType: imageType,
                }));
        }

        return processedItems;}



    static async getAllVideoIds() {
        const userId = await ApiClient._getUserId();
        const movie = await ApiClient.getVideoIds({ userId, imageType: ImageType.primary, videoType: VideoType.movie });
        const series = await ApiClient.getVideoIds({ userId, imageType: ImageType.primary, videoType: VideoType.series });
        const boxset = await ApiClient.getVideoIds({ userId, imageType: ImageType.primary, videoType: VideoType.boxset });
        const season = await ApiClient.getVideoIds({ userId, imageType: ImageType.primary, videoType: VideoType.season });
        const audio = await ApiClient.getVideoIds({ userId, imageType: ImageType.primary, videoType: VideoType.audio });
        const movie_backdrop = await ApiClient.getVideoIds({ userId, imageType: ImageType.backdrop, videoType: VideoType.movie });
        const series_thumbnail = await ApiClient.getVideoIds({ userId, imageType: ImageType.backdrop, videoType: VideoType.series });
        const movie_thumbnail = await ApiClient.getVideoIds({ userId, imageType: ImageType.thumbnail, videoType: VideoType.movie });
        const series_backdrop = await ApiClient.getVideoIds({ userId, imageType: ImageType.thumbnail, videoType: VideoType.series });
        const boxset_backdrop = await ApiClient.getVideoIds({ userId, imageType: ImageType.backdrop, videoType: VideoType.boxset });

        // show all list length
        console.log('movie', movie.length);
        console.log('series', series.length);
        console.log('boxset', boxset.length);
        console.log('season', season.length);
        console.log('movie_backdrop', movie_backdrop.length);
        console.log('series_backdrop', series_backdrop.length);
        console.log('movie_thumbnail', movie_thumbnail.length);
        console.log('series_thumbnail', series_thumbnail.length);
        console.log('boxset_backdrop', boxset_backdrop.length);
        console.log('audio', audio.length);

        const combineList = [...movie, ...series, ...boxset, ...season, ...movie_backdrop, ...series_backdrop, ...boxset_backdrop, ...audio, ...movie_thumbnail, ...series_thumbnail];
        console.log('combineList', combineList.length);
        
        // audio.sort(() => Math.random() - 0.5);

        // shuffle with Fisher-Yates algorithm
        for (let i = combineList.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [combineList[i], combineList[j]] = [combineList[j], combineList[i]];
        }
        
        return combineList;
        // return audio;
    }


 
}