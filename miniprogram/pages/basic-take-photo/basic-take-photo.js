import WuJianAR from "../../libs/wujian-ar-1.0.2";

/**
 * 
 * 技术支持：无间AR
 * 官网: https://www.wujianar.com
 * 技术支持QQ群：722979533
 * 
 */

// 初始化WebAR
const wuJinaAR = new WuJianAR(getApp().globalData.config);

Page({
    data: {
        height: 500,
        imgSrc: '',
    },
    isCameraInitDone: false,
    onLoad() {
        const sys = wx.getSystemInfoSync();
        this.setData({
            height: sys.windowHeight,
        });

        // 识别请求成功后的回调
        wuJinaAR.on(WuJianAR.EVENT_SEARCH, (msg) => {
            console.info(msg);

            // code为200时识别到目标，非200时为未识别到目标
            if (msg.code == 200) {
                wx.showToast({ title: `识别到目标：${msg.data.name}`, icon: 'none', duration: 1000 });
            } else {
                wx.showToast({ title: `未识别到目标`, icon: 'none', duration: 1000 });
            }
        });
    },
    onUnload() {
    },
    cameraDone(e) {
        this.isCameraInitDone = true;
    },
    onError(e) {
        console.info(e);
        wx.showToast({ icon: 'error', title: e.detail.errMsg });
    },
    takePhoto() {
        if (!this.isCameraInitDone) {
            wx.showToast({ title: '相机未打开', icon: 'none' });
            return;
        }

        wx.showLoading({ title: '识别中...' });
        wuJinaAR.searchByTakePhoto().then((filename) => {
            this.setData({
                imgSrc: filename
            });
            wx.hideLoading();
        }).catch(err => {
            console.error(err);
        });
    }
});