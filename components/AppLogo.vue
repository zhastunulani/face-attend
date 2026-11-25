<template>
  <span class="inline-flex items-center gap-2.5">
    <img src="/logo.svg" alt="" :width="size" :height="size" class="shrink-0" />
    <span v-if="!compact" class="font-semibold tracking-tight" :class="dark ? 'text-white' : 'text-navy'">FaceAttend</span>
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number; compact?: boolean; dark?: boolean }>(), { size: 32, compact: false, dark: false })
</script>
