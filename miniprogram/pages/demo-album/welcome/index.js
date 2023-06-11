Page({
    toAlbum() {
        wx.navigateTo({url: '/pages/demo-album/album/index', fail: (err) => console.info(err)});
    }
})