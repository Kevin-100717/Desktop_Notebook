<script setup>
import SideBar from './components/SideBar.vue';
import emitter from './utils/emitter.js';

</script>

<template>
  <SideBar></SideBar>
  <div id="content">
    <router-view v-slot="{ Component }">
      <keep-alive>
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script>
export default {
  methods:{
    goRouter(route){
      this.$router.push(route)
    }
  },
  mounted(){
    emitter.on("push-router",this.goRouter)
  }
}
</script>

<style scoped>
#content{
  position: absolute;
  top: 0px;
  left: 60px;
  height: 100%;
  width: calc( 100% - 60px );
}
</style>