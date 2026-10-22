<template>
  <!-- HLB-FORK: portal-close-comment — the requester's Close. Nobody closes a
       ticket without a comment (company_helpdesk hd_ticket/closing.py, owner
       2026-10-19), so this always asks for one. The rating is asked as before,
       only when helpdesk demands it (askRating), and both go to the server in
       one request: close_with_comment saves the rating with the close. -->
  <Dialog
    :open="open"
    :title="askRating ? __('Rate this ticket') : __('Close ticket')"
    :actions="[
      {
        disabled: (askRating && !preset) || comment.trim().length < minLength,
        loading: close.loading,
        label: __('Close ticket'),
        theme: 'gray',
        variant: 'solid',
        onClick: submit,
      },
    ]"
    @update:open="() => $emit('update:open', !open)"
  >
    <template #default>
      <div class="space-y-4 text-base text-ink-gray-7">
        <template v-if="askRating">
          <div class="flex flex-col gap-2">
            <div>
              <span> {{ __("Select a rating") }} </span>
              <span class="text-ink-red-6"> * </span>
            </div>
            <Rating
              v-model="rating"
              :max="5"
              size="sm"
              @update:model-value="onSelectRating"
            />
          </div>
          <div v-if="options.data?.length" class="space-y-2">
            <span> {{ __("Pick an option") }} </span>
            <span class="text-ink-red-6"> * </span>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="o in options.data"
                :key="o.name"
                :label="o.label"
                :theme="preset === o.name ? 'blue' : 'gray'"
                variant="subtle"
                @click="preset = o.name"
              />
            </div>
          </div>
          <div class="space-y-2">
            <span> {{ __("Other") }} </span>
            <FormControl
              v-model="text"
              type="textarea"
              :placeholder="__('Tell us more')"
            />
          </div>
        </template>
        <div class="space-y-2">
          <span> {{ __("Why are you closing this ticket?") }} </span>
          <span class="text-ink-red-6"> * </span>
          <FormControl
            v-model="comment"
            type="textarea"
            :placeholder="__('For example: it is sorted, thank you.')"
          />
        </div>
        <ErrorMessage :message="error" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { errorText } from "@/utils";
import {
  Button,
  createListResource,
  createResource,
  Dialog,
  ErrorMessage,
  FormControl,
  Rating,
} from "frappe-ui";
import { computed, inject, ref } from "vue";
import { ITicket } from "./symbols";
import { __ } from "@/translation";

interface P {
  open: boolean;
  // HLB-FORK: portal-close-comment — false: the comment alone.
  askRating?: boolean;
}

interface E {
  (event: "update:open", open: boolean): void;
}

defineProps<P>();
const emit = defineEmits<E>();
const ticket = inject(ITicket);
const rating = ref(0);
const text = ref("");
const preset = ref(null);
const options = createListResource({
  doctype: "HD Ticket Feedback Option",
  fields: ["name", "label"],
  pageLength: 99999,
});

// HLB-FORK: portal-close-comment — the minimum length is the server's rule.
const comment = ref("");
const error = ref("");
const context = createResource({
  url: "company_helpdesk.api.cancel_context",
  makeParams: () => ({ ticket: ticket.data.name }),
  auto: true,
});
const minLength = computed(() => context.data?.close_comment_min_length ?? 1);
const close = createResource({
  url: "company_helpdesk.hd_ticket.closing.close_with_comment",
  onSuccess: () => {
    error.value = "";
    emit("update:open", false);
    ticket.reload();
  },
  onError: (err: any) => {
    error.value = errorText(err, __("Could not close the ticket."));
  },
});

function submit() {
  close.submit({
    ticket: ticket.data.name,
    comment: comment.value.trim(),
    feedback: preset.value,
    feedback_extra: text.value,
  });
}

function onSelectRating(r: number) {
  preset.value = null;
  text.value = "";
  options.update({
    filters: {
      rating: r / 5,
      disabled: 0,
    },
  });
  options.reload();
}
</script>
