<template>
    <div id="header-panel">
        <div class="header-top">
            <h1>{{ noteData.det.title }}</h1>
            <span id="create-time">{{ timeString }}</span>
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
    </div>
</template>
<script>
import Vditor from 'vditor';
import "vditor/src/assets/less/index.less"
import { ElNotification, ElOption, ElSelect } from "element-plus"
import { markRaw } from 'vue'
import emitter from '../utils/emitter'

const HEADER_HEIGHT = 112

function editorTheme(theme){
    const dark = theme !== 'light'
    return {
        theme: dark ? 'dark' : 'light',
        content: dark ? 'dark' : 'light',
        code: dark ? 'monokai' : 'github'
    }
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
        async onTagsChange(value){
            const tags = (Array.isArray(value) ? value : [])
                .filter(item=>typeof item === "string")
                .map(item=>item.trim())
                .filter(Boolean)
            if(tags.length === 0){
                this.tagList = [...this.savedTags]
                this.notify("提示","至少保留一个标签","warning")
                return
            }
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
        applyTheme(theme){            if(!this.editor) return
            const target = editorTheme(theme)
            try{
                this.editor.setTheme(target.theme,target.content,target.code)
            }catch{}
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
                after:()=>{
                    if(this.disposed){
                        try{editor.destroy()}catch{}
                        return
                    }
                    editor.setValue(this.noteText)
                    try{this.noteText = editor.getValue()}catch{}
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
    },
    beforeUnmount(){
        this.disposed = true
        this.readId++
        if(this.unsubscribe) this.unsubscribe()
        emitter.off('theme-changed',this.applyTheme)
        if(this.editor){
            try{this.editor.destroy()}catch{}
        }
    }
}
</script>
<style scoped>
#header-panel{
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
    background: var(--bg-1);
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