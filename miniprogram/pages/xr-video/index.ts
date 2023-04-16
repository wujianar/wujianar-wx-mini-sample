Page({
    data: {
        width: 300,
        height: 500,
        ratio: 1,
        useSearch: false,
        isShowBtnClose: false,
        isARReady: false,
    },
    onLoad() {
        const sys = wx.getSystemInfoSync();
        this.setData({
            width: sys.windowWidth,
            height: sys.windowHeight,
            ratio: sys.pixelRatio
        });
    },
    onReady() {
        // 如果5秒后AR系统还未启动
        setTimeout(() => {
            if (!this.data.isARReady) {
                wx.showModal({
                    title: 'AR系统未启动',
                    content: '你的相机未启动或手机不支持XR-FRAME',
                    showCancel: false,
                });
            }
        }, 5000);
    },
    onUnload() {
        this.stopSearch();
    },
    onSearchSuccess(e: any) {
        // console.info(e);
        this.stopSearch();
    },
    onARReady() {
        this.data.isARReady = true;

        this.startSearch();
    },
    startSearch() {
        this.setData({
            useSearch: true,
            isSearching: true,
            isShowBtnClose: false,
        });
    },
    stopSearch() {
        this.setData({
            useSearch: false,
            isSearching: false,
            isShowBtnClose: true,
        });
    },
    removeVideo() {
        this.selectComponent('#xr-video').removeVideo();
        this.startSearch();
    },
});