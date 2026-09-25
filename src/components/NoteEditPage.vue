<template>
    <div id="vditor"></div>
</template>
<script>
import Vditor from 'vditor';
import "vditor/dist/css/content-theme/dark.css"
import "vditor/src/assets/less/index.less"
var editor;
var noteText;
var tocElement;
export default {
    props:{
        noteData:Object
    },
    methods:{
        async getNoteText(){
            noteText = await window.electron.getNoteContent(this.noteData.time)
            console.log(noteText)
        },
        createVditor(){
            editor = new Vditor("vditor",{
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
                after(){
                    editor.setValue(noteText)
                    editor.setTheme("dark","dark","monokai")
                },
                height:"100%",
                outline:{
                    enable:true
                },
                toolbar:[
                    "emoji","headings","bold","italic","strike","|","line","quote","list","ordered-list","check" ,"outdent" ,"indent","code","inline-code","insert-after","insert-before" ,"link","table","|","undo","redo"
                ]
            })
        }
    },
    mounted(){
        tocElement = this.$refs.toc
        console.log(this.noteData)
        this.getNoteText()
        this.createVditor()
        
    }
}
</script>