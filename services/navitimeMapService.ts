// NAVITIME Map Script Loader
const NAVITIME_API_KEY = process.env.NAVITIME_API_KEY || '';


let navitimeMapLoaded = false;
let navitimeMapLoadPromise: Promise<void> | null = null;

// Load NAVITIME Map Script
export const loadNavitimeMapScript = async (): Promise<void> => {
    if (navitimeMapLoaded) {
        return Promise.resolve();
    }

    if (navitimeMapLoadPromise) {
        return navitimeMapLoadPromise;
    }

    navitimeMapLoadPromise = new Promise((resolve, reject) => {
        try {
            // SBI Digital Hubのプロキシ経由でマップスクリプトを取得
            const url = new URL('https://proxy.sbi-digitalhub.co.jp/202209150000004/%E3%82%BF%E3%82%A4%E3%83%AB%E5%9C%B0%E5%9B%B3%E3%82%B9%E3%82%AF%E3%83%AA%E3%83%97%E3%83%88%E5%8F%96%E5%BE%97/1/map_script');
            // ホスト名のみを渡す（ポート番号なし）
            const hostname = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
            url.searchParams.append('host', hostname);

            fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'X-Sbiapi-User-Appkey': NAVITIME_API_KEY,
                    'X-SBIAPI-Host': 'https://proxy.sbi-digitalhub.co.jp'
                }
            })
                .then(response => {
                    if (!response.ok) {
                        // エラーレスポンスの内容を確認
                        return response.text().then(errorText => {
                            console.error('NAVITIME Map API Error Response:', errorText);
                            console.error('Status:', response.status);
                            console.error('Request URL:', url.toString());
                            throw new Error(`Failed to load NAVITIME Map script: ${response.status}`);
                        });
                    }
                    return response.text();
                })
                .then(scriptContent => {
                    // エラーレスポンスでないか確認
                    if (scriptContent.includes('"status_code"') || scriptContent.includes('error')) {
                        console.error('NAVITIME Map API Error:', scriptContent);
                        throw new Error('Invalid response from NAVITIME Map API');
                    }

                    // スクリプトを動的に実行
                    const script = document.createElement('script');
                    script.textContent = scriptContent;
                    script.onload = () => {
                        navitimeMapLoaded = true;
                        resolve();
                    };
                    script.onerror = () => {
                        reject(new Error('Failed to execute NAVITIME Map script'));
                    };
                    document.head.appendChild(script);
                })
                .catch(error => {
                    console.error('Failed to fetch NAVITIME Map script:', error);
                    reject(error);
                });
        } catch (error) {
            reject(error);
        }
    });

    return navitimeMapLoadPromise;
};

// Check if NAVITIME Map is loaded
export const isNavitimeMapLoaded = (): boolean => {
    return navitimeMapLoaded && typeof (window as any).NAVITIME !== 'undefined';
};

// Get NAVITIME Map instance
export const getNavitimeMap = () => {
    if (!isNavitimeMapLoaded()) {
        throw new Error('NAVITIME Map is not loaded yet');
    }
    return (window as any).NAVITIME;
};
