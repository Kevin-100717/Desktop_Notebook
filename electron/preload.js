const { contextBridge,ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld('electron',{
    getUserInfo:()=>ipcRenderer.invoke("get-userinfo"),
    getSetting:(key)=>ipcRenderer.invoke("get-setting",key),
    setSetting:(key,value)=>ipcRenderer.invoke("set-setting",{key:key,value:value}),
    onSettingUpdated:(callback)=>{
        const listener=(_event,setting)=>callback(setting)
        ipcRenderer.on("setting-updated",listener)
        return ()=>ipcRenderer.removeListener("setting-updated",listener)
    },
    getNoteList:()=>ipcRenderer.invoke("get-notelist"),
    getNoteContent:(tid)=>ipcRenderer.invoke("get-notecontent",tid),
    saveNote:(tid,content)=>ipcRenderer.invoke("save-content",{tid:tid,content:content}),
    createNote:(title)=>ipcRenderer.invoke("create-note",title),
    deleteNote:(tid)=>ipcRenderer.invoke("delete-note",tid),
    getTags:()=>ipcRenderer.invoke("get-tags"),
    setNoteTags:(tid,tags)=>ipcRenderer.invoke("set-note-tags",{tid:tid,tags:tags}),
    onNoteUpdated:(callback)=>{
        const listener=(_event,note)=>callback(note)
        ipcRenderer.on("note-updated",listener)
        return ()=>ipcRenderer.removeListener("note-updated",listener)
    },
    getStickyList:()=>ipcRenderer.invoke("get-stickylist"),
    getSticky:(tid)=>ipcRenderer.invoke("get-sticky",tid),
    saveSticky:(tid,content)=>ipcRenderer.invoke("save-sticky",{tid:tid,content:content}),
    createSticky:(title)=>ipcRenderer.invoke("create-sticky",title),
    deleteSticky:(tid)=>ipcRenderer.invoke("delete-sticky",tid),
    openSticky:(tid)=>ipcRenderer.invoke("open-sticky",tid),
    closeSticky:(tid)=>ipcRenderer.invoke("close-sticky",tid),
    openDataFolder:(key)=>ipcRenderer.invoke("open-data-folder",key),
    onTrayAction:(callback)=>{        const listener=(_event,action)=>callback(action)
        ipcRenderer.on("tray-action",listener)
        return ()=>ipcRenderer.removeListener("tray-action",listener)
    }
})