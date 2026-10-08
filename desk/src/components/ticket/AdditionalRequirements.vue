<template>
  <!-- HLB-FORK: additional-requirements — "Are there any additional
       requirements?" between the ticket name and the body editor (app #119).
       Answering No fills the editor with "No additional requirements", so a
       requester with nothing to add can submit at once. TicketNew.vue decides
       which ticket types ask, and owns the editor text. -->
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-2 block text-sm text-ink-gray-7">
      {{ __("Are there any additional requirements?") }}
      <span class="place-self-center text-ink-red-5"> * </span>
    </legend>
    <div class="flex gap-5">
      <label
        v-for="option in OPTIONS"
        :key="option"
        class="flex cursor-pointer items-center gap-2 text-base text-ink-gray-8"
      >
        <input
          type="radio"
          name="hlb-additional-requirements"
          class="size-4 cursor-pointer"
          :value="option"
          :checked="modelValue === option"
          @change="emit('update:modelValue', option)"
        />
        {{ __(option) }}
      </label>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { __ } from "@/translation";

type Answer = "Yes" | "No";

const OPTIONS: Answer[] = ["Yes", "No"];

defineProps<{ modelValue: Answer | "" }>();

const emit = defineEmits<{ (event: "update:modelValue", value: Answer): void }>();
</script>
