const fs = require("fs")
const path = require("path")
const { pathToFileURL } = require("url")
const { protocol, net } = require("electron")

const SCHEME = "dnote-img"
const HOST = "asset"
const ASSET_NAME = /^[0-9a-f]{16}\.(png|jpg|jpeg|gif|webp|bmp)$/

function imageUrl(tid,name){
    return SCHEME + "://" + HOST + "/" + encodeURIComponent(String(tid)) + "/" + encodeURIComponent(String(name))
}
function parseRequestUrl(raw){
    let url = null
    try{ url = new URL(String(raw)) }catch{ return null }
    if(url.protocol !== SCHEME + ":") return null
    if(url.hostname !== HOST) return null
    const parts = url.pathname.split("/").filter(part=>part !== "")
    if(parts.length !== 2) return null
    return { tid:decodeURIComponent(parts[0]), name:decodeURIComponent(parts[1]) }
}
function resolveAssetFile(noteDir,tid,name){
    if(typeof name !== "string" || !ASSET_NAME.test(name)) return ""     // 只认自家写入的哈希文件名
    if(!noteDir) return ""
    const dir = path.resolve(noteDir,"assets")
    const file = path.resolve(dir,name)
    const relative = path.relative(dir,file)
    if(relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return ""
    try{
        if(!fs.statSync(file).isFile()) return ""
    }catch{
        return ""
    }
    return file
}
function notFound(){
    return new Response("not found",{ status:404, headers:{ "content-type":"text/plain; charset=utf-8" } })
}
function badRequest(){
    return new Response("bad request",{ status:400, headers:{ "content-type":"text/plain; charset=utf-8" } })
}
function registerImageScheme(){
    try{
        protocol.registerSchemesAsPrivileged([{
            scheme:SCHEME,
            privileges:{ standard:true, secure:true, supportFetchAPI:true, stream:true, bypassCSP:true, corsEnabled:true }
        }])
    }catch(error){
        console.warn("[img] 协议注册失败：" + error.message)
    }
}
function handleImageRequest(request,getNoteDir){
    if(request.method !== "GET" && request.method !== "HEAD") return badRequest()
    const parsed = parseRequestUrl(request.url)
    if(parsed == null) return badRequest()
    let dir = ""
    try{ dir = getNoteDir(parsed.tid) }catch{ dir = "" }
    const file = resolveAssetFile(dir,parsed.tid,parsed.name)
    if(file === "") return notFound()
    return net.fetch(pathToFileURL(file).toString())      // 交给 Chromium 自己判 Content-Type 与 Range
}
function setupImageProtocol(getNoteDir){
    try{
        protocol.handle(SCHEME, request=>handleImageRequest(request,getNoteDir))
    }catch(error){
        console.warn("[img] 协议处理注册失败：" + error.message)
    }
}
module.exports = {
    SCHEME:SCHEME,
    imageUrl:imageUrl,
    parseRequestUrl:parseRequestUrl,
    resolveAssetFile:resolveAssetFile,
    registerImageScheme:registerImageScheme,
    setupImageProtocol:setupImageProtocol
}
