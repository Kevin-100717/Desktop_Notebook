const ASSET_TAIL = /(?:assets\/|^dnote-img:\/\/asset\/[^/]+\/)([0-9a-f]{16}\.(?:png|jpg|jpeg|gif|webp|bmp))$/i

export function matchAssetName(src){
    const value = String(src == null ? "" : src).trim()
    if(value === "") return ""
    const clean = value.split(/[?#]/)[0]
    const match = clean.match(ASSET_TAIL)
    return match ? match[1].toLowerCase() : ""
}
export function isExternalSrc(src,href){
    const value = String(src == null ? "" : src).trim()
    if(!/^https?:\/\//i.test(value)) return false
    try{
        return new URL(value,href).origin !== new URL(href).origin
    }catch{
        return true
    }
}
export function resolveImageSrc(src,tid,buildUrl,href){
    const value = String(src == null ? "" : src).trim()
    if(value === "") return ""
    if(value.startsWith("data:")) return ""
    if(isExternalSrc(value,href)) return ""
    const name = matchAssetName(value)
    if(name === "" || tid == null || typeof buildUrl !== "function") return ""
    return buildUrl(tid,name)
}
export function toPortableMarkdown(text){
    if(typeof text !== "string" || text === "" || !text.includes("dnote-img:")) return text
    // 兜底：万一编辑器把协议地址写回了正文，落盘前一定换回 ./assets/<文件名>
    return text.replace(/\/?dnote-img:\/\/asset\/[^/\s)"']+\/([0-9a-f]{16}\.[a-z0-9]+)/gi,"./assets/$1")
}
