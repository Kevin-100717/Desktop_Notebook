
const { app, BrowserWindow } = require('electron')
const { join } = require('path')

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        show:false,
        webPreferences: {
            webSecurity: false
        }
    })
 

    const env = app.isPackaged ? 'production' : 'development'
    const indexHtml = {
        development: 'http://localhost:5173', // 开发环境
        production: join(__dirname, '../dist/index.html') // 生产环境
    }
    win.setMenuBarVisibility(false)
    win.loadURL(indexHtml[env])
    win.on("ready-to-show",()=>{
        win.show()
    })
    // win.loadFile('index.html')
 
}
app.whenReady().then(async () => {
    createWindow()
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
