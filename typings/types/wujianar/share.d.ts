interface ARConfig {
    token: string;
    interval: number;
    endpoint: string;
    quantity: number;
}

interface SearchResponse {
    code: number;
    message: string;
    data: TargetInfo;
}

interface TargetInfo {
    name: string;
    uuid: string;
    brief: string;
    image: string;
}

interface FormData {
    contentType: string;
    buffer: ArrayBuffer;
}

interface SearchJsonData {
    image: string;
}

interface VideoSetting {
    videoUrl: string;
    scale?: number;
}

interface ModelSetting {
    modelUrl: string;
    scale: number;
}

interface ErrorMessage {
    message: string;
    reason: any;
}

interface VideoConfig {
    video: WechatMiniprogram.VideoContext;
    width: number;
    height: number;
}

interface TargetSize {
    width: number;
    height: number;
}