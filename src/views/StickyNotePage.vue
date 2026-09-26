<template>
    <div id="sticky-page">
        <div class="sticky-head">
            <span class="sticky-title">{{ title }}</span>
            <span class="sticky-state">{{ stateText }}</span>
            <button class="sticky-close" title="关闭便签" @click="closeWindow">×</button>
        </div>
        <div class="sticky-body">
            <textarea
                ref="bodyRef"
                class="sticky-text"
                v-model="text"
                spellcheck="false"
                placeholder="写点什么…"
                @input="onInput"
                @blur="flush"
            ></textarea>
        </div>
    </div>
</template>

<script>
const SAVE_DELAY = 320

export default {
    data(){
        return {
            tid:'',
            title:'便签',
            text:'',
            savedText:'',
            loaded:false,
            saving:false,
            state:'',
            timer:null
        }
    },
    computed:{
        stateText(){
            if(this.state === 'saved') return '已保存'
            if(this.state === 'saving') return '保存中'
            if(this.state === 'error') return '保存失败'
            return ''
        }
    },
    methods:{
        onInput(){
            this.state = 'saving'
            clearTimeout(this.timer)
            this.timer = setTimeout(()=>this.flush(),SAVE_DELAY)
        },
        async flush(){
            clearTimeout(this.timer)
            if(this.saving || !this.loaded) return
            const content = this.text
            if(content === this.savedText) return
            this.saving = true
            try{
                await window.electron.saveSticky(this.tid,content)
                this.savedText = content
                this.state = 'saved'
            }catch{
                this.state = 'error'
            }finally{
                this.saving = false
            }
        },
        closeWindow(){
            window.close()
        }
    },
    async mounted(){
        this.tid = String(this.$route?.params?.tid || '')
        if(!this.tid) return
        try{
            const data = await window.electron.getSticky(this.tid)
            this.title = data?.title || '便签'
            this.text = typeof data?.content === 'string' ? data.content : ''
            this.savedText = this.text
            this.loaded = true
        }catch{
            this.loaded = true
        }
    },
    beforeUnmount(){
        clearTimeout(this.timer)
    }
}
</script>

<style scoped>
#sticky-page{
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
    background: #ffe98a;
    color: #4a3f12;
    font-family: 'PingFang SC','Microsoft YaHei',system-ui,sans-serif;
}
.sticky-head{
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    height: 30px;
    padding: 0 4px 0 10px;
    background: #f7dc63;
    border-bottom: 1px solid rgba(122,102,10,0.28);
    -webkit-app-region: drag;
    user-select: none;
}
.sticky-title{
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.sticky-state{
    flex-shrink: 0;
    font-size: 11px;
    color: rgba(74,63,18,0.62);
    font-family: var(--font-en);
}
.sticky-close{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    font-size: 15px;
    line-height: 1;
    color: #4a3f12;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    -webkit-app-region: no-drag;
    transition: background 0.15s var(--ease);
}
.sticky-close:hover{
    background: rgba(122,102,10,0.18);
}
.sticky-body{
    flex: 1;
    min-height: 0;
    padding: 8px 10px 10px;
    box-sizing: border-box;
    display: flex;
}
.sticky-text{
    flex: 1;
    width: 100%;
    padding: 0 2px;
    font-family: 'PingFang SC','Microsoft YaHei',system-ui,sans-serif;
    font-size: 15px;
    line-height: 26px;
    color: #4a3f12;
    caret-color: #8a6d00;
    background-color: transparent;
    background-image: repeating-linear-gradient(
        to bottom,
        transparent 0,
        transparent 25px,
        rgba(122,102,10,0.26) 25px,
        rgba(122,102,10,0.26) 26px
    );
    background-attachment: local;
    border: none;
    outline: none;
    resize: none;
    overflow-y: auto;
}
.sticky-text::placeholder{
    color: rgba(74,63,18,0.42);
}
.sticky-text::-webkit-scrollbar{
    width: 6px;
}
.sticky-text::-webkit-scrollbar-track{
    background: transparent;
}
.sticky-text::-webkit-scrollbar-thumb{
    background: rgba(122,102,10,0.3);
    border-radius: 3px;
}
.sticky-text::-webkit-scrollbar-thumb:hover{
    background: rgba(122,102,10,0.5);
}
</style>
