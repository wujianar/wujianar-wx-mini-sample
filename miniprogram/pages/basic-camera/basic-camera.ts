import WuJinaAR from "../../libs/wujian-ar";

/**
 * 
 * 技术支持：无间AR
 * 官网: https://www.wujianar.com
 * 技术支持QQ群：722979533
 * 
 */

// 初始化WebAR
const wuJinaAR = new WuJinaAR(getApp().globalData.config);

Page({
    data: {
        height: 500,
        isSearching: false,
    },
    isCameraInitDone: false,
    onLoad() {
        const sys = wx.getSystemInfoSync();
        this.setData({
            width: sys.windowWidth,
            height: sys.windowHeight,
        });

        // 识别请求成功后的回调
        wuJinaAR.on(WuJinaAR.EVENT_SEARCH, (msg: SearchResponse) => {
            console.info(msg);

            // code为200时识别到目标，非200时为未识别到目标
            if (msg.code == 200) {
                wx.showToast({ title: `识别到目标：${msg.data.name}`, icon: 'none', duration: 500 });
            } else {
                wx.showToast({ title: `未识别到目标`, icon: 'none', duration: 500 });
            }
        });
    },
    onUnload() {       
        this.stopSearch();
        wuJinaAR.dispose();
    },
    // 相机初始化完成，开启识别
    cameraDone(e: any) {
        if (this.isCameraInitDone) {
            return;
        }

        this.isCameraInitDone = true;
    },
    onError(e: any) {
        console.info(e);
        wx.showToast({ icon: 'error', title: e.detail.errMsg });
    },
    // 开始识别
    startSearch() {
        if (!this.isCameraInitDone) {
            wx.showToast({ title: '相机未打开', icon: 'none' });
            return;
        }

        wuJinaAR.startSearch();
        this.setData({
            isSearching: true,
        });
    },
    // 停止识别
    stopSearch() {
        wuJinaAR.stopSearch();
        this.setData({
            isSearching: false,
        });
    }
});