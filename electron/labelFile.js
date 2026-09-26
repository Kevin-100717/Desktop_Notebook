const fs = require("fs")
const path = require("path")
let label_list = null
let dataDir = ""
let labelsDir = ""
let listPath = ""
let watchCallback = null
let listWatched = false
let listTimer = null

function writeAtomic(file,content){
    const tempPath = file+".tmp-"+process.pid+"-"+Date.now()
    try{
        fs.writeFileSync(tempPath,content,"utf-8")
        fs.renameSync(tempPath,file)
    }catch(error){
        try{fs.unlinkSync(tempPath)}catch{}
        throw error
    }
}
function label_init(root=process.cwd()){
    dataDir = path.resolve(root)
    labelsDir = path.join(dataDir,"labels")
    if(!fs.existsSync(labelsDir)){
        fs.mkdirSync(labelsDir,{recursive:true})
    }
    listPath = path.join(labelsDir,"list.json")
    if(!fs.existsSync(listPath)){
        fs.writeFileSync(listPath,"{\"sticky\":[]}")
    }
    label_list = readLabelList()
}
function readLabelList(){
    if(!fs.existsSync(labelsDir)){
        fs.mkdirSync(labelsDir,{recursive:true})
    }
    if(!fs.existsSync(listPath)){
        fs.writeFileSync(listPath,"{\"sticky\":[]}")
    }
    const data = JSON.parse(fs.readFileSync(listPath,"utf-8"))
    if(!data || !Array.isArray(data.sticky)) throw new Error("invalid sticky list")
    data.sticky = data.sticky.filter(item=>item && item.time != null && typeof item.file === "string" && item.file.length > 0)
    return data
}
function writeList(){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    writeAtomic(listPath,JSON.stringify(label_list))
}
function getStickyEntry(t){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    label_list = readLabelList()
    const entry = label_list.sticky.find(item=>String(item.time) === String(t))
    if(!entry) throw new Error("sticky is not found")
    return entry
}
function getStickyFile(entry){
    if(!entry || typeof entry.file !== "string" || entry.file.length === 0){
        throw new Error("invalid sticky path")
    }
    const file = path.resolve(dataDir,entry.file)
    const relative = path.relative(labelsDir,file)
    if(relative.startsWith("..") || path.isAbsolute(relative)){
        throw new Error("invalid sticky path")
    }
    return file
}
function normalizeTitle(title){
    if(typeof title !== "string") throw new Error("invalid sticky title")
    const value = title.trim()
    if(!value) throw new Error("empty sticky title")
    if(value.length > 60) throw new Error("sticky title is too long")
    return value
}
function randomSuffix(){
    return Math.random().toString(36).slice(2,8)
}
function createSticky(title){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    const value = normalizeTitle(title)
    label_list = readLabelList()
    const t = new Date().getTime()
    const file = path.join(labelsDir,String(t)+"-"+randomSuffix()+".txt")
    writeAtomic(file,"")
    const det = {
        title:value,
        createAt:new Date().toLocaleString()
    }
    const entry = {
        time:t,
        file:path.relative(dataDir,file),
        det:det
    }
    label_list.sticky.push(entry)
    writeList()
    return entry
}
function getStickies(){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    label_list = readLabelList()
    return label_list
}
function readSticky(t){
    const entry = getStickyEntry(t)
    let content = ""
    try{
        content = fs.readFileSync(getStickyFile(entry),{ encoding:'utf-8' })
    }catch{
        content = ""
    }
    return { time:entry.time, title:entry.det?.title || "便签", content:content }
}
function saveSticky(data){
    if(!data || typeof data.content !== "string") throw new Error("invalid sticky content")
    if(data.content.length > 200000) throw new Error("sticky content is too long")
    const entry = getStickyEntry(data.tid)
    writeAtomic(getStickyFile(entry),data.content)
    return "success"
}
function deleteSticky(t){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    label_list = readLabelList()
    const index = label_list.sticky.findIndex(item=>String(item.time) === String(t))
    if(index === -1) throw new Error("sticky is not found")
    const entry = label_list.sticky[index]
    let file = ""
    try{
        file = getStickyFile(entry)
    }catch{}
    label_list.sticky.splice(index,1)
    writeList()
    if(file){
        try{fs.unlinkSync(file)}catch{}
    }
    try{
        if(fs.readdirSync(labelsDir).length === 0) fs.rmdirSync(labelsDir)
    }catch{}
    return "success"
}
function watchSticky(callback){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    watchCallback = callback
    if(listWatched) return
    fs.watchFile(listPath,{persistent:true,interval:200},()=>{
        clearTimeout(listTimer)
        listTimer = setTimeout(()=>{
            try{
                label_list = readLabelList()
                watchCallback({sticky:true})
            }catch{}
        },100)
    })
    listWatched = true
}
module.exports = {
    label_init:label_init,
    getStickies:getStickies,
    readSticky:readSticky,
    saveSticky:saveSticky,
    createSticky:createSticky,
    deleteSticky:deleteSticky,
    watchSticky:watchSticky
}
