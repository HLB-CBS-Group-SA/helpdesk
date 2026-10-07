<template>
  <!-- HLB-FORK: brand-logo — the HLB CBS Group South Africa wordmark at the
  foot of the sidebar, on the agent desk and the portal (app #109). Blue on the
  light theme, white on the dark one; both are transparent WebP from marketing.
  It shares the last row with the collapse button (AppSidebar's `brand` slot).
  Hidden when the sidebar is collapsed: the brand icon at the top stays. -->
  <div v-if="!isCollapsed" class="min-w-0 flex-1 px-2 select-none">
    <img
      :src="logoBlue"
      :alt="__('HLB CBS Group South Africa')"
      class="hlb-wordmark hlb-wordmark-light"
      draggable="false"
    />
    <img
      :src="logoWhite"
      :alt="__('HLB CBS Group South Africa')"
      class="hlb-wordmark hlb-wordmark-dark"
      draggable="false"
    />
  </div>
</template>

<script setup lang="ts">
import logoBlue from "@/assets/hlb/hlb-logo-blue.webp";
import logoWhite from "@/assets/hlb/hlb-logo-white.webp";
import { __ } from "@/translation";

defineProps<{ isCollapsed: boolean }>();
</script>

<style>
.hlb-wordmark {
  display: block;
  width: 100%;
  max-width: 9rem;
  height: auto;
}
.hlb-wordmark-dark {
  display: none;
}
[data-theme="dark"] .hlb-wordmark-light {
  display: none;
}
[data-theme="dark"] .hlb-wordmark-dark {
  display: block;
}
</style>
