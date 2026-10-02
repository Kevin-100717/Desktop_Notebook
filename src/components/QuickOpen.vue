<template>
    <div v-if="visible" class="quick-mask" @mousedown="close">
        <div class="quick-panel" @mousedown.stop>
            <div class="quick-input">
                <input
                    ref="input"
                    v-model="keyword"
                    placeholder="搜一下，回车打开"
                    @keydown.down.prevent="move(1)"
                    @keydown.up.prevent="move(-1)"
                    @keydown.enter.prevent="chooseActive"
                    @keydown.esc.prevent="close"
                >
                <span class="quick-count">{{ items.length }}</span>
            </div>
            <div class="quick-list">
                <p v-if="loading" class="quick-tip">加载中…</p>
                <p v-else-if="items.length === 0" class="quick-tip">没找到，换个词试试</p>
                <button
                    v-for="(item,index) in items"
                    :key="item.kind + '-' + item.time"
                    class="quick-item"
                    :class="{ active: index === activeIndex }"
                    @mouseenter="activeIndex = index"
                    @click="choose(item)"
                >
                    <span class="quick-badge" :class="item.kind">{{ item.kind === "note" ? "笔记" : "便签" }}</span>
                    <span class="quick-main">
                        <span class="quick-title" v-html="item.titleHtml"></span>
                        <span v-if="item.sub" class="quick-sub">{{ item.sub }}</span>
                    </span>
                </button>
            </div>
            <div class="quick-foot">↑↓ 选一选 · Enter 打开 · Esc 关上</div>
        </div>
    </div>
</template>

<script>
import { ElMessage } from 'element-plus';
import emitter from '../utils/emitter.js';
import NoteEditPage from './NoteEditPage.vue';

const RECENT_LIMIT = 30
const LOCAL_LIMIT = 50
const QUERY_BODY_MIN = 2

function escapeHtml(value){
    return String(value == null ? "" : value)
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#39;")
}
function matchScore(haystack,query){
    const text = String(haystack == null ? "" : haystack).toLowerCase()
    const key = query.toLowerCase()
    if(key === "") return 0
    if(text === key) return 1200
    const direct = text.indexOf(key)
    if(direct === 0) return 1000
    if(direct > 0) return 700 - Math.min(direct,300)
    let cursor = 0
    let score = 0
    for(const char of key){
        const found = text.indexOf(char,cursor)
        if(found === -1) return -1
        score += found === cursor ? 2 : 1
        cursor = found + 1
    }
    return score
}
function titleHtml(title,query){
    const text = escapeHtml(title)
    const marked = escapeHtml(String(query == null ? "" : query).trim())
    if(marked === "") return text || "无标题"
    const at = text.toLowerCase().indexOf(marked.toLowerCase())
    if(at === -1) return text || "无标题"
    return text.slice(0,at) + "<mark>" + text.slice(at,at + marked.length) + "</mark>" + text.slice(at + marked.length)
}

export default {
    components:{},
    data(){
        return {
            visible:false,
            keyword:"",
            items:[],
            activeIndex:0,
            loading:false,
            notes:[],
            stickies:[],
            requestId:0
        }
    },
    watch:{
        keyword(){
            this.refresh()
        }
    },
    mounted(){
        this.onKeydown = event=>{
            const modifier = event.ctrlKey || event.metaKey
            if(!modifier || event.altKey) return
            const key = String(event.key || "").toLowerCase()
            if(key !== "p" || event.shiftKey) return
            event.preventDefault()
            event.stopPropagation()
            if(this.visible) this.close()
            else this.open()
        }
        window.addEventListener("keydown",this.onKeydown,true)
        emitter.on("open-quick-open",this.open)
        this.offOpen = ()=>emitter.off("open-quick-open",this.open)
    },
    beforeUnmount(){
        window.removeEventListener("keydown",this.onKeydown,true)
        if(this.offOpen) this.offOpen()
    },
    methods:{
        async open(){
            this.visible = true
            this.keyword = ""
            this.activeIndex = 0
            this.loading = true
            try{
                const [notes,stickies] = await Promise.all([
                    window.electron.getNoteList().catch(()=>({ notes:[] })),
                    window.electron.getStickyList().catch(()=>({ sticky:[] }))
                ])
                this.notes = Array.isArray(notes?.notes) ? notes.notes : []
                this.stickies = Array.isArray(stickies?.sticky) ? stickies.sticky : []
            }catch{
                this.notes = []
                this.stickies = []
            }
            this.loading = false
            if(!this.visible) return      // 取列表的空档里被关掉了，就别再写界面
            this.items = this.recentItems()
            this.$nextTick(()=>{
                const input = this.$refs.input
                if(input) input.focus()
            })
        },
        close(){
            this.visible = false
            this.keyword = ""
            this.items = []
            this.activeIndex = 0
        },
        candidates(){
            const list = []
            this.notes.forEach(note=>{
                const det = note.det || {}
                list.push({
                    kind:"note",
                    time:note.time,
                    title:String(det.title || ""),
                    tags:Array.isArray(note.tags) ? note.tags : [],
                    entry:note
                })
            })
            this.stickies.forEach(sticky=>{
                const det = sticky.det || {}
                list.push({
                    kind:"sticky",
                    time:sticky.time,
                    title:String(det.title || ""),
                    tags:Array.isArray(sticky.tags) ? sticky.tags : [],
                    entry:sticky
                })
            })
            return list
        },
        recentItems(){
            const list = this.candidates()
                .sort((a,b)=>Number(b.time) - Number(a.time))
                .slice(0,RECENT_LIMIT)
            return list.map(item=>this.toItem(item,"",1))
        },
        toItem(item,query,score){
            const query_ = String(query == null ? "" : query).trim()
            const tags = item.tags.map(tag=>"#" + tag).join(" ")
            return {
                kind:item.kind,
                time:item.time,
                title:item.title,
                titleHtml:titleHtml(item.title,query_),
                sub:tags,
                score:score,
                jumpTerm:item.jumpTerm || "",
                entry:item.entry
            }
        },
        async bodyHits(query){
            try{
                const result = await window.electron.searchContent(query)
                const results = Array.isArray(result?.results) ? result.results : []
                return results.map(hit=>({
                    kind:hit.kind,
                    time:hit.time,
                    jumpTerm:hit.jumpTerm || "",
                    snippet:hit.snippet || null
                }))
            }catch{
                return []
            }
        },
        snippetText(snippet){
            if(!snippet) return ""
            const text = String(snippet.text == null ? "" : snippet.text).replace(/\s+/g," ").trim()
            return text.length > 120 ? "…" + text.slice(0,120) + "…" : text
        },
        async refresh(){
            const query = this.keyword.trim()
            const request = ++this.requestId
            if(query === ""){
                this.items = this.recentItems()
                this.activeIndex = 0
                return
            }
            const pool = this.candidates()
            const list = this.scoreLocal(pool, query)
            const byKey = new Map()
            list.forEach(item=>byKey.set(item.kind + "-" + item.time,item))
            if(query.length >= QUERY_BODY_MIN){
                const hits = await this.bodyHits(query)
                if(request !== this.requestId || !this.visible) return
                this.mergeBodyHits(list, byKey, pool, hits, query)
            }
            if(request !== this.requestId || !this.visible) return
            this.items = list
            this.activeIndex = 0
        },
        scoreLocal(pool, query){
            const scored = []
            for(const item of pool){
                const tagText = item.tags.join(" ")
                const score = Math.max(matchScore(item.title,query),matchScore(tagText,query))
                if(score >= 0) scored.push({ item:item, score:score })
            }
            scored.sort((a,b)=>b.score - a.score || Number(b.item.time) - Number(a.item.time))
            const picked = scored.slice(0,LOCAL_LIMIT)
            return picked.map(entry=>this.toItem(entry.item,query,entry.score))
        },
        mergeBodyHits(list, byKey, pool, hits, query){
            for(const hit of hits){
                const key = hit.kind + "-" + hit.time
                const existing = byKey.get(key)
                if(existing){
                    const text = this.snippetText(hit.snippet)
                    if(text !== "") existing.sub = existing.sub ? existing.sub + " · " + text : text
                    continue
                }
                const source = pool.find(item=>item.kind === hit.kind && item.time === hit.time)
                if(!source) continue
                const added = this.toItem(source,query,1)
                const text = this.snippetText(hit.snippet)
                added.sub = text !== "" ? text : added.sub
                added.jumpTerm = hit.jumpTerm || added.jumpTerm
                byKey.set(key,added)
                list.push(added)
            }
        },
        move(step){
            if(this.items.length === 0) return
            const next = this.activeIndex + step
            this.activeIndex = (next + this.items.length) % this.items.length
        },
        chooseActive(){
            const item = this.items[this.activeIndex]
            if(!item) return
            this.choose(item)
        },
        async choose(item){
            if(!item) return
            this.close()
            if(item.kind === "sticky"){
                try{
                    await window.electron.openSticky(item.time)
                }catch{
                    ElMessage.error("便签窗口打开失败")
                }
                return
            }
            const entry = item.entry || { time:item.time, det:{ title:item.title }, tags:[] }
            const term = String(item.jumpTerm || '').trim()
            emitter.emit("add-tab",{
                title:item.title,
                component:NoteEditPage,
                props:{ noteData:entry },
                closable:true
            })
            if(term !== ''){
                setTimeout(()=>emitter.emit("note-jump",{ tid:item.time, term:term }),40)
            }
        }
    }
}
</script>

<style scoped>
.quick-mask{
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 12vh;
    background: rgba(0,0,0,0.28);
}
.quick-panel{
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: min(620px, 92vw);
    max-height: 68vh;
    background: var(--surface-1);
    border: 1px solid var(--border-2);
    border-radius: var(--radius-2);
    box-shadow: 0 18px 48px rgba(0,0,0,0.22);
    overflow: hidden;
}
.quick-input{
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-1);
}
.quick-input input{
    flex: 1 1 auto;
    height: 24px;
    font-size: 14px;
    color: var(--text-1);
    background: transparent;
    border: 0;
    outline: none;
}
.quick-input input::placeholder{
    color: var(--text-2);
}
.quick-count{
    flex-shrink: 0;
    font-size: 12px;
    font-family: var(--font-en);
    color: var(--text-2);
}
.quick-list{
    flex: 1 1 auto;
    min-height: 0;
    padding: 6px;
    overflow-y: auto;
}
.quick-item{
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-1);
    cursor: pointer;
}
.quick-item.active{
    background: var(--accent-soft);
    border-color: var(--accent-border);
}
.quick-badge{
    flex-shrink: 0;
    width: 34px;
    text-align: center;
    padding: 2px 0;
    font-size: 11px;
    color: var(--text-2);
    background: var(--block-2);
    border-radius: var(--radius-1);
}
.quick-badge.note{
    color: var(--accent-strong);
    background: var(--accent-soft);
}
.quick-main{
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1 1 auto;
}
.quick-title{
    font-size: 13px;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.quick-title :deep(mark){
    color: var(--accent-strong);
    background: transparent;
}
.quick-sub{
    font-size: 12px;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.quick-tip{
    margin: 0;
    padding: 14px 12px;
    font-size: 13px;
    color: var(--text-2);
}
.quick-foot{
    flex-shrink: 0;
    padding: 8px 14px;
    font-size: 11px;
    color: var(--text-2);
    border-top: 1px solid var(--border-1);
}
</style>
