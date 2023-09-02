import WuJianAR from "../../libs/wujian-ar";

/**
 * 
 * 技术支持：无间AR
 * 官网: https://www.wujianar.com
 * 技术支持QQ群：722979533
 * 
 */

// 初始化WebAR
const wuJianAR = new WuJianAR(getApp().globalData.config);

Page({
    data: {
        height: 500,
        videoUrl: '',
        isSearching: false,
        isShowBtnClose: false,
    },
    isCameraInitDone: false,
    onLoad() {
        const sys = wx.getSystemInfoSync();
        this.setData({
            width: sys.windowWidth,
            height: sys.windowHeight,
        });

        // 识别请求成功后的回调
        wuJianAR.on(WuJianAR.EVENT_SEARCH, (msg) => {
            console.info(msg);

            // code为200时识别到目标，非200时为未识别到目标
            if (msg.code !== 200) {
                wx.showToast({ title: `未识别到目标`, icon: 'none', duration: 1000 });
                return;
            }

            this.stopSearch();
            wx.showToast({ title: `识别到目标：${msg.data.name}`, icon: 'none', duration: 1000 });

            // 解析关联数据
            // 本例的数据为：　{code: 200, data: {name: "视频", uuid: "b0f131e8818348eeb160e081a936c578", brief: "{"videoUrl":"https://wujianar-cdn.oss-cn-hangzhou.aliyuncs.com/ardemo/videos/2.mp4"}"}, message: "succeed"}
            const setting: VideoSetting = JSON.parse(msg.data.brief);
            this.showVideo(setting);
        });
    },
    onUnload() {        
        this.stopSearch();
        wuJianAR.dispose();
    },
    // 相机初始化完成，开启识别
    cameraDone(e: any) {
        // 全屏视频也会触发，所以记录下，全屏播放时不识别
        if (this.isCameraInitDone) {
            return;
        }

        this.isCameraInitDone = true;
        this.startSearch();
    },
    onError(e: any) {
        console.error(e);
        wx.showToast({ icon: 'error', title: e.detail.errMsg });
    },
    // 关闭视频播放
    closeVideo() {
        this.setData({
            videoUrl: '',
            isShowBtnClose: false,
        });
        this.startSearch();
    },
    // 播放视频
    showVideo(setting: VideoSetting) {
        if (!setting.videoUrl) {
            wx.showToast({ title: '视频地址错误', icon: 'error' });
            this.startSearch();
            return;
        }

        this.setData({
            videoUrl: setting.videoUrl,
            isShowBtnClose: true,
        });
    },
    // 开始识别
    startSearch() {
        wuJianAR.startSearch();
        this.setData({
            isSearching: true,
            isShowBtnClose: false,
        });
    },
    // 停止识别
    stopSearch() {
        wuJianAR.stopSearch();
        this.setData({
            isSearching: false,
            isShowBtnClose: true,
        });
    }
});