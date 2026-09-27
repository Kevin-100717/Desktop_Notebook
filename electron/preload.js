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
    renameNote:(tid,title)=>ipcRenderer.invoke("rename-note",{tid:tid,title:title}),
    getTags:()=>ipcRenderer.invoke("get-tags"),
    setNoteTags:(tid,tags)=>ipcRenderer.invoke("set-note-tags",{tid:tid,tags:tags}),
    renameTag:(from,to)=>ipcRenderer.invoke("rename-tag",{from:from,to:to}),
    removeTag:(tag)=>ipcRenderer.invoke("remove-tag",{tag:tag}),
    searchContent:(keyword)=>ipcRenderer.invoke("search-content",keyword),
    getTrash:()=>ipcRenderer.invoke("get-trash"),
    restoreTrash:(kind,tid)=>ipcRenderer.invoke("restore-trash",{kind:kind,tid:tid}),
    purgeTrash:(kind,tid)=>ipcRenderer.invoke("purge-trash",{kind:kind,tid:tid}),
    emptyTrash:()=>ipcRenderer.invoke("empty-trash"),
    importNotes:(mode)=>ipcRenderer.invoke("import-notes",{mode:mode}),
    exportContent:(kind,tid)=>ipcRenderer.invoke("export-content",{kind:kind,tid:tid}),
    backupData:()=>ipcRenderer.invoke("backup-data"),
    getGraph:()=>ipcRenderer.invoke("get-graph"),
    addGraphNoteNode:(tid,x,y)=>ipcRenderer.invoke("add-graph-note-node",{tid:tid,x:x,y:y}),
    addGraphTextNode:(x,y,text)=>ipcRenderer.invoke("add-graph-text-node",{x:x,y:y,text:text}),
    updateGraphNode:(id,x,y,text)=>ipcRenderer.invoke("update-graph-node",{id:id,x:x,y:y,text:text}),
    removeGraphNode:(id)=>ipcRenderer.invoke("remove-graph-node",{id:id}),
    addGraphEdge:(from,to,fromSide)=>ipcRenderer.invoke("add-graph-edge",{from:from,to:to,fromSide:fromSide}),
    removeGraphEdge:(id)=>ipcRenderer.invoke("remove-graph-edge",{id:id}),
    onGraphUpdated:(callback)=>{
        const listener=(_event,info)=>callback(info)
        ipcRenderer.on("graph-updated",listener)
        return ()=>ipcRenderer.removeListener("graph-updated",listener)
    },
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