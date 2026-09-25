<template>
    <div id="sidebar">
        <div id="slider" :style="{ top: sliderTop + 'px' }"></div>
        <div :class="{'menu-item':true,'active':this.curr == i}" v-for="(item, i) in menuList" :key="i" @click="pushRouter(i)">
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
    width: 60px;
    height: 100%;
    border-right: 1px solid #494949;
}
.menu-item{
    margin-left: 3px;
    margin-bottom: 8px;
    width: 50px;
    height: 50px;
    overflow: hidden;
    user-select: none;
    cursor: pointer;
}
.menu-item .icon{
    width: 25px;
    height: 25px;
    margin-left: 15px;
    margin-top: 7px;
    background-color: var(--unhighlight);
    transition: all 0.1s ease-in-out;
}
.menu-item:hover .icon,.menu-item.active .icon{
    background-color: white;
}
.menu-item p{
    color: var(--unhighlight);
    font-family: var(--font-en);
    text-align: center;
    width: 50px;
    font-size: 10px;
    margin-left: 3px;
    transition: all 0.1s ease-in-out;
}
.menu-item:hover p,.menu-item.active p{
    color: white;
}
#slider{
    position: absolute;
    width: 60px;
    height: 50px;
    transition: top 0.3s ease-in-out;
    background-color: #e8d63136;
}
#slider::before{
    position: absolute;
    content: " ";
    width: 3px;
    height: 50px;
    background-color: var(--highlight-1);
}
</style>