export const loadNavitimeMapScript = async (): Promise<void> => {
    if ((window as any).navitime) {
        return Promise.resolve();
    }

    // Use Vite proxy for RapidAPI NAVITIME Maps endpoint
    const proxyUrl = '/api/map_script';

    try {
        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const scriptContent = await response.text();

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const blob = new Blob([scriptContent], { type: 'text/javascript' });
            const objectUrl = URL.createObjectURL(blob);

            script.src = objectUrl;
            script.onload = () => {
                URL.revokeObjectURL(objectUrl);
                resolve();
            };
            script.onerror = (e) => reject(e);
            document.head.appendChild(script);
        });

    } catch (error) {
        console.error('Failed to load Navitime Map script:', error);
        throw error;
    }
};
