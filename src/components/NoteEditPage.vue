<template>
    <div ref="editorElement" class="vditor" @keydown.capture="handleKeydown"></div>
</template>
<script>
import Vditor from 'vditor';
import "vditor/dist/css/content-theme/dark.css"
import "vditor/src/assets/less/index.less"
import { ElNotification } from "element-plus"
import { markRaw } from 'vue'

export default {
    props:{
        noteData:Object
    },
    data(){
        return {
            editor:null,
            ready:false,
            disposed:false,
            noteText:"",
            diskVersion:0,
            readId:0,
            pendingSaveContent:null,
            queuedSaveContent:null,
            savePromise:null,
            unsubscribe:null
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
                    editor.setTheme("dark","dark","monokai")
                    this.ready = true
                },
                height:"100%",
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
        this.unsubscribe = window.electron.onNoteUpdated(note=>this.applyFileUpdate(note))
        const version = this.diskVersion
        try{
            const content = await window.electron.getNoteContent(this.noteData.time)
            if(this.disposed) return
            if(version === this.diskVersion) this.noteText = content
            this.createVditor()
        }catch{
            this.notify("错误","笔记加载失败","error")
        }
    },
    activated(){
        this.refreshFromDisk()
    },
    beforeUnmount(){
        this.disposed = true
        this.readId++
        if(this.unsubscribe) this.unsubscribe()
        if(this.editor){
            try{this.editor.destroy()}catch{}
        }
    }
}
</script>