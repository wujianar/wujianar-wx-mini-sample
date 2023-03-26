import ThreeHelper from "../../libs/three-helper";
import WuJianAR from "../../libs/wujian-ar-1.0.1";

/**
 * 
 * 技术支持：无间AR
 * 官网: https://www.wujianar.com
 * 技术支持QQ群：722979533
 * 
 */

// 初始化WebAR
const wuJianAR = new WuJianAR(getApp().globalData.config);
const threeHelper = new ThreeHelper();

Page({
    data: {
        height: 500,
        isSearching: false,
        isShowBtnClose: false,
    },
    isCameraInitDone: false,
    canvas: null,
    onLoad() {
        const sys = wx.getSystemInfoSync();
        this.setData({
            width: sys.windowWidth,
            height: sys.windowHeight
        });
        // 识别请求成功后的回调
        wuJianAR.on(WuJianAR.EVENT_SEARCH, (msg: SearchResponse) => {
            console.info(msg);

            // code为200时识别到目标，非200时为未识别到目标
            if (msg.code !== 200) {
                wx.showToast({ title: `未识别到目标`, icon: 'none', duration: 1000 });
                return;
            }

            this.stopSearch();
            wx.showToast({ title: `识别到目标：${msg.data.name}`, icon: 'none', duration: 1000 });

            // 解析关联数据
            // 如：{code: 200, data: {name: "恐龙", uuid: "3ba85677176f49569364d958f5014fa1", brief: "{"modelUrl":"https://wujianar-cdn.oss-cn-hangzhou.aliyuncs.com/ardemo/models/kl.gltf","scale":0.07}"}, message: "succeed"}
            const setting: ModelSetting = JSON.parse(msg.data.brief);
            this.showModel(setting);

        });

        // threejs 更新事件
        threeHelper.on(ThreeHelper.EVENT_TICK, (delta: number) => {
            // console.info(delta);
        });
    },
    async onReady() {
        // 将webgl canvas传给threejs
        try {
            this.canvas = await this.queryCanvas('#webgl');
        } catch (err) {
            console.info(err);
            wx.showToast({ title: '未找到模型渲染的canvas', icon: 'error' });
            return;
        }

        // @ts-ignore
        threeHelper.setCanvas(this.canvas);
        // 手势事件
        threeHelper.addOrbitControl();
    },
    onUnload() {
        this.stopSearch();
        wuJianAR.dispose();
    },
    // 相机初始化完成，开启识别
    cameraDone(e: any) {
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
    // 卸载模型
    removeModel() {
        threeHelper.reset();
        this.setData({
            isSearching: true,
        });
        this.startSearch();
    },
    showModel(setting: ModelSetting) {
        if (!setting.modelUrl) {
            wx.showToast({ title: '模型地址错误', icon: 'error' });
            this.startSearch();
            return;
        }

        // 本例使用的跟踪sample的配置,scale很小，所以X10，请你按实际情况调整
        setting.scale *= 10;
        threeHelper.loadModel(setting).then(() => {
            console.info('loaded');
        }).catch((err: ErrorMessage) => {
            console.info(err);
            wx.showToast({ title: err.message, icon: 'error' });
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
    },
    queryCanvas(target: string): Promise<any> {
        return new Promise((resolve, reject) => {
            wx.createSelectorQuery()
                .select(target)
                .node(res => {
                    if (res == null) {
                        return reject(`未找到${target}`);
                    }
                    return resolve(res.node);
                }).exec();
        });
    },

    /* 手势事件 START */
    touchStart(e: any) {
        // @ts-ignore
        this.canvas.dispatchTouchEvent(e,);
    },
    touchMove(e: any) {
        // @ts-ignore
        this.canvas.dispatchTouchEvent(e);
    },
    touchEnd(e: any) {
        // @ts-ignore
        this.canvas.dispatchTouchEvent(e);
    },
    /* 手势事件 END */
});