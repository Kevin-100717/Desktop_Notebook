<template>
    <div class="edit-page">
    <div id="header-panel">
        <div class="header-top">
            <h1>{{ noteData.det.title }}</h1>
            <div class="header-side">
                <span class="word-count">{{ wordCountText }}</span>
                <span id="create-time">{{ timeString }}</span>
            </div>
        </div>
        <div class="tag-bar">
            <el-select
                v-model="tagList"
                class="tag-select"
                multiple
                filterable
                allow-create
                default-first-option
                :multiple-limit="3"
                :disabled="tagsSaving"
                placeholder="添加标签，最多 3 个"
                @change="onTagsChange"
            >
                <el-option v-for="tag in allTags" :key="tag" :label="tag" :value="tag"></el-option>
            </el-select>
            <span v-if="tagsSaving" class="tag-status">保存中</span>
            <div class="view-tools">
                <button
                    class="tool-btn"
                    :class="{ active: reading }"
                    :title="reading ? '回到编辑模式' : '以阅读模式查看渲染结果'"
                    @click="toggleReading"
                >{{ reading ? "编辑" : "阅读" }}</button>
                <button
                    class="tool-btn"
                    :class="{ active: uiState.focus }"
                    :title="uiState.focus ? '退出专注模式' : '隐藏侧栏、标签栏与 Tab 栏，只留正文'"
                    @click="toggleFocus"
                >{{ uiState.focus ? "退出专注" : "专注" }}</button>
            </div>
        </div>
    </div>
    <div class="editor-wrap">
        <div ref="editorElement" class="vditor" @keydown.capture="handleKeydown"></div>
        <div v-if="loadError" class="editor-loading">
            <p class="loading-text">笔记加载失败，请重新打开该标签页</p>
        </div>
        <div v-else-if="!ready" class="editor-loading">
            <div class="loading-skeleton">
                <span class="skeleton-line w90"></span>
                <span class="skeleton-line w70"></span>
                <span class="skeleton-line w85"></span>
                <span class="skeleton-line w60"></span>
                <span class="skeleton-line w75"></span>
            </div>
            <div class="loading-status">
                <span>编辑器加载中</span>
                <span class="loading-track"><i></i></span>
            </div>
        </div>
        <div v-if="reading" class="reader">
            <div ref="readerElement" class="reader-body"></div>
        </div>
    </div>
    </div>
</template>
<script>
import Vditor from 'vditor';
import "vditor/src/assets/less/index.less"
import { ElNotification, ElOption, ElSelect } from "element-plus"
import { markRaw } from 'vue'
import emitter from '../utils/emitter'
import uiState from '../utils/uiState'

const HEADER_HEIGHT = 112
const CJK_RANGE = /[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff]/

function editorTheme(theme){
    const dark = theme !== 'light'
    return {
        theme: dark ? 'dark' : 'light',
        content: dark ? 'dark' : 'light',
        code: dark ? 'monokai' : 'github',
        dark
    }
}
function countWords(text){
    const plain = String(text == null ? "" : text)
        .replace(/```[\s\S]*?```/g," ")
        .replace(/[#*`>\[\]()!_|~-]/g," ")
    let cjk = 0
    let rest = ""
    for(const char of plain){
        if(CJK_RANGE.test(char)) cjk++
        else rest += char
    }
    const words = rest.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g)
    return cjk + (words ? words.length : 0)
}

export default {
    components:{ ElOption, ElSelect },
    props:{
        noteData:Object
    },
    data(){
        return {
            editor:null,
            ready:false,
            loadError:false,
            tagList:[],
            savedTags:[],
            allTags:[],
            tagsSaving:false,
            disposed:false,
            noteText:"",
            editorText:"",
            reading:false,
            wordCount:0,
            wordTimer:null,
            diskVersion:0,
            readId:0,
            pendingSaveContent:null,
            queuedSaveContent:null,
            savePromise:null,
            unsubscribe:null,
            timeString:""
        }
    },
    computed:{
        uiState(){
            return uiState
        },
        wordCountText(){
            return this.wordCount + " 字"
        },
        isDirty(){
            if(!this.ready || !this.editor) return false
            try{
                return this.editor.getValue() !== this.noteText
            }catch{
                return false
            }
        }
    },
    methods:{
        async loadTags(){
            if(this.disposed) return
            try{
                const all = await window.electron.getTags()
                if(this.disposed) return
                this.allTags = Array.isArray(all) ? all : []
            }catch{}
        },
        syncEditorText(){
            if(!this.editor) return
            try{
                this.setEditorText(this.editor.getValue())
            }catch{}
        },
        setEditorText(text){
            if(typeof text !== "string") return
            this.editorText = text
            this.scheduleWordCount()
        },
        scheduleWordCount(){
            if(this.wordTimer) clearTimeout(this.wordTimer)
            this.wordTimer = setTimeout(()=>{
                this.wordTimer = null
                if(this.disposed) return
                this.wordCount = countWords(this.editorText)
            },400)
        },
        currentMarkdown(){
            if(this.ready && this.editor){
                try{
                    const value = this.editor.getValue()
                    if(typeof value === "string") return value
                }catch{}
            }
            return this.editorText || this.noteText || ""
        },
        toggleFocus(){
            uiState.focus = !uiState.focus
        },
        toggleReading(){
            this.reading = !this.reading
            if(this.reading) this.renderReader()
        },
        renderReader(){
            this.$nextTick(()=>{
                const target = this.$refs.readerElement
                if(!target || this.disposed) return
                const style = editorTheme(document.documentElement.getAttribute('data-theme'))
                const markdown = this.currentMarkdown()
                try{
                    Promise.resolve(Vditor.preview(target,markdown,{
                        mode:style.dark ? "dark" : "light",
                        hljs:{
                            enable:true,
                            lineNumber:true,
                            style:style.code
                        },
                        anchor:0,
                        math:{
                            engine:"MathJax"
                        }
                    })).catch(()=>{
                        if(!this.disposed && target) target.textContent = markdown
                    })
                }catch{
                    target.textContent = markdown
                }
            })
        },
        async onTagsChange(value){
            const tags = (Array.isArray(value) ? value : [])
                .filter(item=>typeof item === "string")
                .map(item=>item.trim())
                .filter(Boolean)
            if(tags.length > 3){
                this.tagList = [...this.savedTags]
                this.notify("提示","最多只能使用 3 个标签","warning")
                return
            }
            if(this.tagsSaving) return
            const previous = [...this.savedTags]
            this.tagsSaving = true
            try{
                const result = await window.electron.setNoteTags(this.noteData.time, tags)
                if(this.disposed) return
                this.savedTags = [...result.tags]
                this.tagList = [...result.tags]
                this.allTags = Array.isArray(result.allTags) ? result.allTags : this.allTags
            }catch{
                if(!this.disposed){
                    this.tagList = previous
                    this.notify("错误","标签保存失败","error")
                }
            }finally{
                this.tagsSaving = false
            }
        },
        handleKeydown(event){
            if((event.ctrlKey || event.metaKey) && !event.repeat && event.key.toLowerCase() === "s"){
                event.preventDefault()
                event.stopPropagation()
                this.save()
            }
        },
        notify(title,message,type){
            ElNotification({
                id:`note-save-${this.noteData.time}`,
                title,
                message,
                type,
                position:"bottom-right"
            })
        },
        applyFileUpdate(note){
            if(note?.deleted) return
            if(String(note.tid) !== String(this.noteData.time)) return
            if(note.content === this.noteText) return
            const current = this.ready ? this.editor.getValue() : null
            const ownSave = note.content === this.pendingSaveContent
            const canUpdate = !this.ready || current === this.noteText
            this.diskVersion++
            this.noteText = note.content
            if(!this.ready || current === note.content || ownSave) return
            if(canUpdate){
                this.editor.setValue(note.content)
                try{this.noteText = this.editor.getValue()}catch{}
                this.setEditorText(note.content)
            }else{
                this.notify("提示","文件已更新，当前未保存修改已保留","warning")
            }
        },
        async refreshFromDisk(){
            if(this.disposed || !this.editor) return
            const request = ++this.readId
            const version = this.diskVersion
            try{
                const content = await window.electron.getNoteContent(this.noteData.time)
                if(this.disposed || request !== this.readId || version !== this.diskVersion) return
                this.applyFileUpdate({tid:this.noteData.time,content})
            }catch{}
        },
        async save(){
            if(!this.ready || !this.editor || this.disposed) return false
            let content
            try{
                content = this.editor.getValue()
            }catch{
                this.notify("错误","编辑器尚未就绪","error")
                return false
            }
            if(this.savePromise){
                this.queuedSaveContent = content
                return this.savePromise
            }
            this.queuedSaveContent = content
            this.savePromise = Promise.resolve().then(()=>this.saveContent())
            return this.savePromise
        },
        async saveContent(){
            try{
                while(this.queuedSaveContent !== null && !this.disposed){
                    const content = this.queuedSaveContent
                    this.queuedSaveContent = null
                    this.pendingSaveContent = content
                    try{
                        const result = await window.electron.saveNote(this.noteData.time,content)
                        if(this.disposed) return false
                        if(result !== "success") throw new Error(result)
                        this.noteText = content
                        this.setEditorText(content)
                        this.notify("完成","保存成功","success")
                    }catch{
                        if(!this.disposed) this.notify("错误","保存失败","error")
                        return false
                    }finally{
                        if(this.pendingSaveContent === content) this.pendingSaveContent = null
                    }
                }
                return !this.disposed
            }finally{
                this.savePromise = null
                this.queuedSaveContent = null
                this.pendingSaveContent = null
            }
        },
        applyTheme(theme){
            if(!this.editor) return
            const target = editorTheme(theme)
            try{
                this.editor.setTheme(target.theme,target.content,target.code)
            }catch{}
            if(this.reading) this.renderReader()
        },
        createVditor(){
            if(this.disposed || this.editor) return
            const editor = new Vditor(this.$refs.editorElement,{
                preview:{
                    hljs:{
                        enable:true,
                        lineNumber:true,
                        style:"monokai"
                    }
                },
                cache:{
                    enable:false
                },
                mode:"ir",
                input:(md)=>{
                    if(this.disposed) return
                    this.setEditorText(md)
                },
                after:()=>{
                    if(this.disposed){
                        try{editor.destroy()}catch{}
                        return
                    }
                    editor.setValue(this.noteText)
                    try{this.noteText = editor.getValue()}catch{}
                    this.syncEditorText()
                    this.wordCount = countWords(this.editorText)
                    const target = editorTheme(document.documentElement.getAttribute('data-theme'))
                    editor.setTheme(target.theme,target.content,target.code)
                    this.ready = true
                },
                height:`calc( 100% - ${HEADER_HEIGHT}px )`,
                outline:{
                    enable:true
                },
                toolbar:[
                    "emoji","headings","bold","italic","strike","|"
                    ,"line","quote","list","ordered-list","check" ,"outdent"
                    ,"indent","code","inline-code","insert-after","insert-before"
                    ,"link","table","|","undo","redo","|","edit-mode","|",
                    {
                        name: 'save',
                        tipPosition: 's',
                        tip: '保存文档',
                        className: 'right',
                        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><path fill="white" d="M832 384H576V128H192v768h640zm-26.496-64L640 154.496V320zM160 64h480l256 256v608a32 32 0 0 1-32 32H160a32 32 0 0 1-32-32V96a32 32 0 0 1 32-32m160 448h384v64H320zm0-192h160v64H320zm0 384h384v64H320z"/></svg>',
                        click:()=>this.save()
                    },
                ],
            })
            this.editor = markRaw(editor)
        }
    },
    async mounted(){
        document.documentElement.style.setProperty('--editor-header-height', HEADER_HEIGHT + 'px')
        this.unsubscribe = window.electron.onNoteUpdated(note=>this.applyFileUpdate(note))
        emitter.on('theme-changed',this.applyTheme)
        const initialTags = Array.isArray(this.noteData.tags) ? this.noteData.tags.filter(item=>typeof item === "string" && item.trim()) : []
        this.savedTags = [...initialTags]
        this.tagList = [...initialTags]
        this.loadTags()
        const version = this.diskVersion
        try{
            const content = await window.electron.getNoteContent(this.noteData.time)
            const date = new Date()
            date.setTime(this.noteData.time)
            this.timeString = "创建于 - "+date.toLocaleDateString()
            if(this.disposed) return
            if(version === this.diskVersion) this.noteText = content
            this.createVditor()
        }catch{
            this.loadError = true
            this.notify("错误","笔记加载失败","error")
        }
    },
    activated(){
        this.loadTags()
        this.refreshFromDisk()
        this.syncEditorText()
        if(this.reading) this.renderReader()
    },
    beforeUnmount(){
        this.disposed = true
        this.readId++
        if(this.wordTimer) clearTimeout(this.wordTimer)
        if(this.unsubscribe) this.unsubscribe()
        emitter.off('theme-changed',this.applyTheme)
        if(this.editor){
            try{this.editor.destroy()}catch{}
        }
    }
}
</script>
<style scoped>
.edit-page{
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
}
#header-panel{
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 3;
    box-sizing: border-box;
    height: var(--editor-header-height, 112px);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
    padding: 0 24px;
    background: var(--surface-1);
    border-bottom: 1px solid var(--border-1);
}
.header-top{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}
#header-panel h1{
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.header-side{
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
}
.word-count{
    flex-shrink: 0;
    padding: 5px 12px;
    font-size: 13px;
    color: var(--text-2);
    font-family: var(--font-en);
    white-space: nowrap;
    border: 1px solid var(--border-1);
    border-radius: 999px;
    background: var(--block-1);
}
#create-time{
    flex-shrink: 0;
    padding: 5px 12px;
    font-size: 13px;
    color: var(--text-2);
    font-family: var(--font-en);
    white-space: nowrap;
    border: 1px solid var(--border-1);
    border-radius: 999px;
    background: var(--block-1);
}
.view-tools{
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
}
.tool-btn{
    height: 30px;
    padding: 0 14px;
    font-size: 13px;
    color: var(--text-2);
    background: var(--block-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s var(--ease), border-color 0.15s var(--ease), background 0.15s var(--ease);
}
.tool-btn:hover{
    color: var(--text-1);
    border-color: var(--border-2);
}
.tool-btn.active{
    color: var(--accent-strong);
    background: var(--accent-soft);
    border-color: var(--accent-border);
}
.tag-bar{
    display: flex;
    align-items: center;
    gap: 10px;
}
.tag-select{
    width: min(380px, 100%);
}
.tag-status{
    flex-shrink: 0;
    font-size: 12px;
    color: var(--text-2);
}
:deep(.tag-select .el-select__wrapper){
    min-height: 30px;
    padding: 2px 8px;
    gap: 4px;
    background: var(--block-1);
    box-shadow: none;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    transition: border-color 0.15s var(--ease);
}
:deep(.tag-select .el-select__wrapper:hover){
    border-color: var(--border-2);
}
:deep(.tag-select .el-select__wrapper.is-focused){
    border-color: var(--accent-border);
}
:deep(.tag-select .el-tag){
    --el-tag-bg-color:var(--accent-soft);
    --el-tag-border-color:var(--accent-border);
    --el-tag-text-color:var(--accent-strong);
    height: 22px;
    border-radius: var(--radius-1);
}
:deep(.tag-select .el-tag .el-tag__close){
    color: var(--accent-strong);
}
:deep(.tag-select .el-select__placeholder){
    font-size: 13px;
    color: var(--text-2);
}
:deep(.tag-select .el-select__input){
    font-size: 13px;
}
.editor-wrap{
    position: relative;
    height: 100%;
}
.editor-loading{
    position: absolute;
    left: 0;
    right: 0;
    top: var(--editor-header-height, 112px);
    bottom: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 34px 40px;
    background: var(--bg-1);
}
.loading-skeleton{
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.skeleton-line{
    display: block;
    height: 14px;
    border-radius: 4px;
    background: var(--block-1);
    animation: skeleton-pulse 1.5s var(--ease) infinite;
}
.skeleton-line.w90{ width: 90%; }
.skeleton-line.w85{ width: 85%; }
.skeleton-line.w75{ width: 75%; }
.skeleton-line.w70{ width: 70%; }
.skeleton-line.w60{ width: 60%; }
@keyframes skeleton-pulse{
    0%,100%{ opacity: 1; }
    50%{ opacity: 0.4; }
}
.loading-status{
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: auto;
    font-size: 13px;
    color: var(--text-2);
}
.loading-track{
    flex: 1;
    height: 3px;
    border-radius: 2px;
    background: var(--block-1);
    overflow: hidden;
}
.loading-track i{
    display: block;
    width: 32%;
    height: 100%;
    background: var(--accent-strong);
    animation: loading-slide 1.1s var(--ease) infinite;
}
@keyframes loading-slide{
    0%{ transform: translateX(-110%); }
    100%{ transform: translateX(340%); }
}
.loading-text{
    font-size: 14px;
    color: var(--text-2);
}
.vditor{
    position: absolute;
    top: var(--editor-header-height, 112px);
    left: 0;
    right: 0;
    background: var(--bg-1);
}
.reader{
    position: absolute;
    top: var(--editor-header-height, 112px);
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 4;
    overflow-y: auto;
    background: var(--bg-1);
    animation: reader-in 0.18s var(--ease);
}
@keyframes reader-in{
    from{ opacity: 0; }
    to{ opacity: 1; }
}
.reader-body{
    box-sizing: border-box;
    max-width: 780px;
    margin: 0 auto;
    padding: 40px 32px 96px;
    font-size: 16px;
    line-height: 1.85;
    color: var(--text-1);
    word-break: break-word;
}
.reader-body:empty::after{
    content: "这篇笔记还没有内容";
    display: block;
    font-size: 14px;
    color: var(--text-2);
}
.reader-body :deep(h1),
.reader-body :deep(h2),
.reader-body :deep(h3),
.reader-body :deep(h4),
.reader-body :deep(h5),
.reader-body :deep(h6){
    margin: 1.6em 0 0.7em;
    font-weight: 600;
    line-height: 1.4;
}
.reader-body :deep(h1){ font-size: 28px; }
.reader-body :deep(h2){
    font-size: 23px;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--border-1);
}
.reader-body :deep(h3){ font-size: 20px; }
.reader-body :deep(h4),
.reader-body :deep(h5),
.reader-body :deep(h6){ font-size: 17px; }
.reader-body :deep(p){
    margin: 0.9em 0;
}
.reader-body :deep(a){
    color: var(--accent-strong);
    text-decoration: none;
}
.reader-body :deep(a:hover){
    text-decoration: underline;
}
.reader-body :deep(blockquote){
    margin: 1.2em 0;
    padding: 2px 0 2px 16px;
    color: var(--text-2);
    border-left: 3px solid var(--accent-border);
}
.reader-body :deep(ul),
.reader-body :deep(ol){
    margin: 0.9em 0;
    padding-left: 1.6em;
}
.reader-body :deep(li){
    margin: 0.35em 0;
}
.reader-body :deep(li.task-list-item){
    list-style: none;
}
.reader-body :deep(li.task-list-item input){
    margin-right: 8px;
    vertical-align: middle;
}
.reader-body :deep(code){
    padding: 2px 6px;
    font-size: 0.88em;
    font-family: var(--font-en);
    background: var(--block-1);
    border-radius: var(--radius-1);
}
.reader-body :deep(pre){
    margin: 1.2em 0;
    padding: 14px 16px;
    overflow-x: auto;
    background: var(--block-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
}
.reader-body :deep(pre code){
    padding: 0;
    background: transparent;
    font-size: 13.5px;
    line-height: 1.7;
}
.reader-body :deep(table){
    width: 100%;
    margin: 1.2em 0;
    border-collapse: collapse;
    font-size: 14px;
}
.reader-body :deep(th),
.reader-body :deep(td){
    padding: 8px 12px;
    border: 1px solid var(--border-1);
    text-align: left;
}
.reader-body :deep(th){
    background: var(--block-1);
    font-weight: 600;
}
.reader-body :deep(img){
    max-width: 100%;
    border-radius: var(--radius-1);
}
.reader-body :deep(hr){
    height: 1px;
    margin: 2em 0;
    border: 0;
    background: var(--border-1);
}
.reader-body del{
    color: var(--text-2);
}
:deep(.vditor-toolbar){
    background: var(--surface-1);
    border-bottom: 1px solid var(--border-1);
}
:deep(.vditor-reset){
    color: var(--text-1);
    font-size: 15px;
}
</style>