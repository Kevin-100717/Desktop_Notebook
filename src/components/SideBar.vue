<template>
    <div id="sidebar">
        <div id="slider" :style="{ top: sliderTop + 'px' }"></div>
        <div :class="{'menu-item':true,'active':this.curr == i}" v-for="(item, i) in menuList" :key="i" :title="item.name" @click="pushRouter(i)">
            <div class="icon" :style="{ maskImage: item.icon }"></div>
            <p>{{ item.name }}</p>
        </div>
    </div>
</template>

<script>
import emitter from '../utils/emitter';

export default {
    data(){
        return{
            curr:0,
            sliderTop: 0,
            menuList:[
                { name:"Notes", icon:"var(--icon-document)" },
                { name:"Setting", icon:"var(--icon-setting)" }
            ],
            routes:[
                "/",
                "/settings"
            ]
        }
    },
    methods:{
        syncRoute(path){
            const ind = this.routes.indexOf(path)
            if(ind !== -1){
                this.curr = ind
                this.sliderTop = ind * 58
            }
        },
        pushRouter(ind){
            this.syncRoute(this.routes[ind])
            emitter.emit("push-router",this.routes[ind])
        }
    },
    watch:{
        "$route.path":{
            immediate:true,
            handler(path){
                this.syncRoute(path)
            }
        }
    }
}
</script>

<style scoped>
#sidebar{
    position: relative;
    width: 60px;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--surface-1);
    border-right: 1px solid var(--border-1);
}
.menu-item{
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    width: 50px;
    height: 50px;
    margin-bottom: 8px;
    border-radius: var(--radius-1);
    overflow: hidden;
    user-select: none;
    cursor: pointer;
    transition: background 0.15s var(--ease);
}
.menu-item .icon{
    width: 23px;
    height: 23px;
    background-color: var(--unhighlight);
    transition: background-color 0.15s var(--ease);
}
.menu-item:hover .icon,.menu-item.active .icon{
    background-color: var(--text-1);
}
.menu-item p{
    color: var(--unhighlight);
    font-family: var(--font-en);
    text-align: center;
    font-size: 11px;
    letter-spacing: 0.3px;
    transition: color 0.15s var(--ease);
}
.menu-item:hover p,.menu-item.active p{
    color: var(--text-1);
}
#slider{
    position: absolute;
    left: 0;
    top: 0;
    width: 60px;
    height: 50px;
    pointer-events: none;
    background: var(--accent-soft);
    transition: top 0.28s var(--ease);
}
#slider::before{
    position: absolute;
    content: " ";
    left: 0;
    top: 0;
    width: 3px;
    height: 50px;
    background-color: var(--accent-strong);
}
</style>