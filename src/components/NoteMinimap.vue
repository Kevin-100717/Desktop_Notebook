<template>
    <div
        ref="root"
        class="doc-map"
        :class="{ 'doc-map-off': !visible }"
        @mousedown="onPress"
    >
        <div class="doc-map-lines">
            <span
                v-for="(line,index) in lines"
                :key="index"
                class="doc-map-line"
                :class="'kind-' + line.kind"
                :style="lineStyle(line)"
            ></span>
        </div>
        <div v-if="viewportHeight > 0" class="doc-map-window" :style="windowStyle"></div>
    </div>
</template>

<script>
const MAX_LINES = 260
const LINE_GAP = 2

export default {
    props:{
        markdown:{ type:String, default:'' },
        ratio:{ type:Number, default:0 },
        visible:{ type:Boolean, default:true }
    },
    emits:['seek'],
    data(){
        return {
            viewportHeight:0
        }
    },
    computed:{
        lines(){
            const raw = String(this.markdown || '')
            if(raw.length === 0) return []
            const all = raw.split('\n')
            const step = Math.max(1,Math.ceil(all.length / MAX_LINES))
            const list = []
            for(let i = 0; i < all.length; i += step){
                const text = all[i]
                const trimmed = text.replace(/^\s+/,'')
                const indent = text.length - trimmed.length
                let kind = 'text'
                let weight = 0.55
                if(trimmed === ''){
                    kind = 'gap'
                    weight = 0.16
                }else if(/^#{1,6}\s/.test(trimmed)){
                    kind = /^\s*#\s/.test(trimmed) ? 'title' : 'head'
                    weight = 1
                }else if(/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)){
                    kind = 'rule'
                    weight = 0.7
                }else if(/^\s*[-*+]\s/.test(trimmed)){
                    kind = 'list'
                    weight = 0.42
                }else if(/^\s*\d+[.)]\s/.test(trimmed)){
                    kind = 'list'
                    weight = 0.42
                }else if(/^>\s?/.test(trimmed)){
                    kind = 'quote'
                    weight = 0.5
                }else if(/^```/.test(trimmed)){
                    kind = 'code'
                    weight = 0.34
                }else if(/^\s*\|/.test(trimmed)){
                    kind = 'table'
                    weight = 0.38
                }
                const width = Math.min(100,18 + trimmed.length * 2.2 * weight)
                list.push({ kind, width, indent:Math.min(24,indent) })
            }
            return list
        },
        contentHeight(){
            const count = this.lines.length
            if(count === 0) return 0
            return count * (3 + LINE_GAP)
        },
        windowStyle(){
            const root = this.$refs.root
            const box = root && root.getBoundingClientRect ? root.getBoundingClientRect() : null
            const total = Math.max(1,box ? box.height : 1)
            const ratio = Math.min(1,Math.max(0,Number(this.ratio) || 0))
            const height = Math.min(total,Math.max(18,total * 0.22))
            const top = ratio * (total - height)
            return { height:height + 'px', top:Math.round(top) + 'px' }
        }
    },
    methods:{
        lineStyle(line){
            return { width:Math.round(line.width) + '%', marginLeft:line.indent + 'px' }
        },
        onPress(event){
            const root = this.$refs.root
            const box = root && root.getBoundingClientRect ? root.getBoundingClientRect() : null
            if(box == null || box.height <= 0) return
            const ratio = Math.min(1,Math.max(0,(event.clientY - box.top) / box.height))
            this.$emit('seek',ratio)
        }
    }
}
</script>

<style scoped>
.doc-map{
    position: absolute;
    /* 顶部要避开标题栏，不然会盖住标签页那一条 */
    top: var(--editor-header-height, 148px);
    right: 0;
    bottom: 0;
    z-index: 2;
    width: 96px;
    padding: 14px 8px 14px 10px;
    box-sizing: border-box;
    overflow: hidden;
    cursor: pointer;
    background: linear-gradient(to right,transparent,var(--bg-1) 24%);
    opacity: 0.9;
    transition: opacity 0.15s var(--ease);
}
.doc-map:hover{
    opacity: 1;
}
.doc-map-off{
    display: none;
}
.doc-map-lines{
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.doc-map-line{
    display: block;
    flex-shrink: 0;
    height: 3px;
    border-radius: 2px;
    background: var(--border-2);
}
.doc-map-line.kind-title{
    height: 5px;
    background: var(--accent-strong);
}
.doc-map-line.kind-head{
    background: var(--accent-strong);
    opacity: 0.8;
}
.doc-map-line.kind-gap{
    background: transparent;
}
.doc-map-line.kind-rule{
    background: var(--text-2);
}
.doc-map-line.kind-quote{
    background: var(--text-2);
    opacity: 0.7;
}
.doc-map-line.kind-code{
    background: var(--text-2);
    opacity: 0.55;
}
.doc-map-line.kind-list{
    opacity: 0.75;
}
.doc-map-line.kind-table{
    opacity: 0.6;
}
.doc-map-window{
    position: absolute;
    left: 6px;
    right: 6px;
    box-sizing: border-box;
    border: 1px solid var(--accent-border);
    border-radius: 4px;
    background: var(--accent-soft);
    pointer-events: none;
    transition: top 0.12s var(--ease);
}
</style>