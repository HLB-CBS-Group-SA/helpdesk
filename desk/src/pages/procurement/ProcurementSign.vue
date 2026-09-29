<template>
  <!-- HLB-FORK: procurement-signature — the Director's signing page, reached
       from the link emailed when a Procurement Request is raised. The Director
       need not be an agent and never gets the ticket itself: the server shows
       them the request as its receipt prints it, and lets them sign only if
       they are the Director named on it (company_helpdesk procurement_api). -->
  <div class="flex flex-col overflow-y-auto">
    <div
      class="mx-auto flex w-full max-w-4xl flex-col gap-5 px-5 py-6 text-ink-gray-8"
    >
      <div>
        <div class="text-lg-medium text-ink-gray-9">
          {{ __("Procurement Request {0}", ticketId) }}
        </div>
        <div v-if="ctx.subject" class="text-p-base text-ink-gray-6">
          {{ ctx.subject }}
        </div>
      </div>

      <div
        v-if="context.error"
        class="rounded border border-outline-gray-2 bg-surface-gray-1 px-3 py-2 text-p-sm"
      >
        {{
          context.error?.messages?.[0] ||
          __(
            "This request could not be opened. Sign in with the account it was sent to."
          )
        }}
      </div>

      <template v-else-if="context.data">
        <!-- The request exactly as the receipt prints it. Sandboxed: no scripts. -->
        <iframe
          v-if="ctx.html"
          :srcdoc="ctx.html"
          sandbox=""
          :title="__('The request')"
          class="h-[60vh] w-full rounded border border-outline-gray-2 bg-surface-white"
        />

        <div
          v-if="ctx.can?.director_sign"
          class="flex flex-col gap-3 rounded border border-outline-gray-2 p-4"
        >
          <FormControl
            type="checkbox"
            :label="
              __(
                'As the Requesting Director, I confirm the need for this cost and its benefit to the Group.'
              )
            "
            v-model="confirmed"
          />
          <SignaturePad v-model="signature" />
          <p class="text-p-sm text-ink-gray-5">
            {{
              __(
                "Your signature is recorded with your Microsoft 365 account, the time, your IP address and browser, and a fingerprint of the request as shown above."
              )
            }}
          </p>
          <div class="flex justify-end">
            <Button
              variant="solid"
              :label="__('Sign')"
              :disabled="!confirmed || !signature"
              :loading="sign.loading"
              @click="submit"
            />
          </div>
        </div>
        <div
          v-else
          class="rounded border border-outline-gray-2 bg-surface-gray-1 px-3 py-2 text-p-sm"
        >
          {{ doneMessage }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import SignaturePad, {
  type Signature,
} from "@/components/ticket/SignaturePad.vue";
import { __ } from "@/translation";
import { Button, createResource, FormControl, toast } from "frappe-ui";
import { computed, ref } from "vue";

const props = defineProps<{ ticketId: string }>();
const API = "company_helpdesk.procurement_api";

const context = createResource({
  url: `${API}.get_context`,
  makeParams: () => ({ ticket: props.ticketId }),
  auto: true,
});
const ctx = computed(() => context.data || {});

const confirmed = ref(false);
const signature = ref<Signature | null>(null);

const sign = createResource({
  url: `${API}.director_sign`,
  onSuccess(data: any) {
    context.data = data;
    toast.success(__("Signed. Thank you."));
  },
  onError(error: any) {
    // frappe-ui rejects with an Error; never hand the object to a toast.
    toast.error(
      error?.messages?.[0] || error?.message || __("That did not work.")
    );
  },
});

function submit() {
  if (!signature.value) return;
  sign.submit({
    ticket: props.ticketId,
    image: signature.value.image,
    method: signature.value.method,
    typed_name: signature.value.typed_name,
  });
}

const doneMessage = computed(() => {
  const signed = (ctx.value.signatures || []).some(
    (s: any) => s.role === "Director"
  );
  if (signed) return __("The Director has signed this request.");
  return __("There is nothing for you to sign on this request.");
});
</script>
