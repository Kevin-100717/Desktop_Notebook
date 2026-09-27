const fs = require("fs")
const { getNotes, getNoteContentPathByEntry } = require("./noteFile")
const { getStickies, getStickyContentPathByEntry } = require("./labelFile")

const SNIPPET_RADIUS = 42
const MAX_RESULTS = 200
const contentCache = new Map()

function normalizeKeyword(value){
    if(typeof value !== "string") throw new Error("invalid keyword")
    return value.trim().slice(0,100)
}
function cacheKey(file){
    try{
        const stat = fs.statSync(file)
        return file+"|"+stat.mtimeMs+"|"+stat.size
    }catch{
        return file+"|0|0"
    }
}
function readCached(file){
    const key = cacheKey(file)
    const cached = contentCache.get(file)
    if(cached != null && cached.key === key) return cached.content
    let content = ""
    try{
        content = fs.readFileSync(file,{ encoding:'utf-8' })
    }catch{
        content = ""
    }
    contentCache.set(file,{ key:key, content:content })
    return content
}
function pruneCache(liveFiles){
    if(contentCache.size <= liveFiles.size * 2) return
    for(const file of contentCache.keys()){
        if(!liveFiles.has(file)) contentCache.delete(file)
    }
}
function collapse(text){
    return String(text).replace(/\r/g,"").replace(/[#*`>\[\]()!_|-]{1,}/g," ").replace(/\s+/g," ").trim()
}
function indexOfLower(haystack,needle){
    return String(haystack).toLowerCase().indexOf(needle)
}
function buildSnippet(flat,index,length){
    const start = Math.max(0,index-SNIPPET_RADIUS)
    const end = Math.min(flat.length,index+length+SNIPPET_RADIUS)
    return {
        text:flat.slice(start,end),
        matchStart:index-start,
        matchEnd:index-start+length,
        prefix:start > 0,
        suffix:end < flat.length
    }
}
function searchOne(item){
    const keyword = item.keyword
    const title = String(item.title || "")
    if(indexOfLower(title,keyword) !== -1){
        return {
            kind:item.kind,
            time:item.time,
            title:title,
            field:"title",
            snippet:{
                text:collapse(item.content || "").slice(0,140),
                matchStart:-1,
                matchEnd:-1,
                prefix:false,
                suffix:false
            }
        }
    }
    const flat = collapse(item.content || "")
    const index = indexOfLower(flat,keyword)
    if(index === -1) return null
    return {
        kind:item.kind,
        time:item.time,
        title:title,
        field:"content",
        snippet:buildSnippet(flat,index,keyword.length)
    }
}
function searchAll(data){
    const keyword = normalizeKeyword(data)
    if(!keyword) return { keyword:keyword, results:[] }
    const lower = keyword.toLowerCase()
    const candidates = []
    const liveFiles = new Set()
    getNotes().notes.forEach(note=>{
        let content = ""
        try{
            const file = getNoteContentPathByEntry(note)
            liveFiles.add(file)
            content = readCached(file)
        }catch{
            content = ""
        }
        candidates.push({
            keyword:lower,
            kind:"note",
            time:note.time,
            title:note.det && note.det.title,
            content:content
        })
    })
    getStickies().sticky.forEach(sticky=>{
        let content = ""
        try{
            const file = getStickyContentPathByEntry(sticky)
            liveFiles.add(file)
            content = readCached(file)
        }catch{
            content = ""
        }
        candidates.push({
            keyword:lower,
            kind:"sticky",
            time:sticky.time,
            title:sticky.det && sticky.det.title,
            content:content
        })
    })
    pruneCache(liveFiles)
    const results = []
    for(const candidate of candidates){
        if(results.length >= MAX_RESULTS) break
        const hit = searchOne(candidate)
        if(hit) results.push(hit)
    }
    results.sort((a,b)=>{
        if(a.field !== b.field) return a.field === "title" ? -1 : 1
        return Number(b.time) - Number(a.time)
    })
    return { keyword:keyword, results:results, truncated:results.length >= MAX_RESULTS }
}
function clearSearchCache(){
    contentCache.clear()
}
module.exports = {
    searchAll:searchAll,
    clearSearchCache:clearSearchCache
}
