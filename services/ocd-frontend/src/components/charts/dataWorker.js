self.onmessage = (e) => {
    const { data, factor } = e.data;

    const downsampleData = (data, factor) => data.filter((_, index) => index % factor === 0);

    const shortTimeLabels = data.timestamp.map((ts) =>
        new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );

    const result = {
        labels: downsampleData(shortTimeLabels, factor),
        ltp: downsampleData(data.ltp, factor),
        oichng: downsampleData(data.oichng, factor),
        oi: downsampleData(data.oi, factor),
    };

    self.postMessage(result);
};
