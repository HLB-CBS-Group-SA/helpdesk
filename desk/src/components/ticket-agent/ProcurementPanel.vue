<template>
  <!-- HLB-FORK: procurement-signature — the Procurement Request's flow on the
       ticket: where it is, who has signed, and the one step open to the person
       looking at it. Every action is a company_helpdesk procurement_api call;
       the server decides who may do what and this only offers what it allows. -->
  <div v-if="context.data" class="px-4 py-4 flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <span class="text-ink-gray-8 text-base-semibold">
        {{ __("Procurement") }}
      </span>
      <Button
        :label="__('Download receipt')"
        icon-left="lucide-file-down"
        :disabled="!can.download"
        @click="downloadReceipt"
      />
    </div>

    <!-- the stages -->
    <ol v-if="ctx.stage !== 'Declined'" class="flex flex-wrap gap-x-4 gap-y-1">
      <li
        v-for="(step, i) in STAGES"
        :key="step"
        class="flex items-center gap-1.5 text-sm"
        :class="
          i === stageIndex
            ? 'text-ink-gray-9 font-medium'
            : i < stageIndex
            ? 'text-ink-gray-6'
            : 'text-ink-gray-4'
        "
      >
        <LucideCheck v-if="i < stageIndex" class="size-3.5" />
        <span v-else class="size-3.5 text-center">{{ i + 1 }}</span>
        {{ __(step) }}
      </li>
    </ol>
    <div
      v-else
      class="rounded border border-outline-gray-2 bg-surface-gray-1 px-3 py-2 text-p-sm text-ink-gray-8"
    >
      {{ __("Declined.") }}
    </div>

    <p v-if="note" class="text-p-sm text-ink-gray-6">{{ note }}</p>

    <!-- signatures -->
    <div v-if="ctx.signatures.length" class="flex flex-col gap-2">
      <div
        v-for="(s, i) in ctx.signatures"
        :key="i"
        class="flex items-center gap-3 rounded border border-outline-gray-2 px-3 py-2"
      >
        <img
          v-if="s.image"
          :src="s.image"
          :alt="__('Signature of {0}', s.signer_name)"
          class="h-10 w-32 shrink-0 object-contain bg-surface-white"
        />
        <div class="min-w-0 flex-1 text-p-sm">
          <div class="text-ink-gray-8">
            {{ __(s.role) }}: {{ s.signer_name }}
            <span v-if="s.decision" class="text-ink-gray-6"
              >· {{ s.decision }}</span
            >
          </div>
          <div class="text-ink-gray-5">
            {{ formatWhen(s.signed_on) }} ·
            {{ s.method === "Declaration" ? __("declaration") : __(s.method) }}
            <span v-if="!s.current">
              · {{ __("the request has changed since") }}</span
            >
          </div>
        </div>
      </div>
    </div>

    <!-- Awaiting Director -->
    <div v-if="can.accept_upload || can.resend" class="flex flex-wrap gap-2">
      <Button
        v-if="can.accept_upload"
        :label="__('Accept the uploaded approval')"
        :loading="busy"
        @click="run('accept_uploaded_approval')"
      />
      <Button
        v-if="can.resend"
        :label="__('Resend the Director\'s link')"
        :loading="busy"
        @click="run('resend_director_link')"
      />
    </div>

    <!-- Operations review: send to an authoriser -->
    <div v-if="can.send" class="flex flex-wrap items-end gap-2">
      <div class="min-w-48 flex-1">
        <span class="mb-1.5 block text-sm text-ink-gray-7">{{
          __("Authoriser")
        }}</span>
        <FormControl
          type="select"
          :options="[
            { label: '', value: '' },
            ...ctx.team.map((m) => ({ label: m.name, value: m.user })),
          ]"
          v-model="authoriser"
        />
      </div>
      <Button
        variant="solid"
        :label="__('Validated: send to authoriser')"
        :disabled="!authoriser"
        :loading="busy"
        @click="run('send_to_authoriser', { authoriser })"
      />
    </div>

    <!-- Awaiting authorisation: decide and sign -->
    <div v-if="can.authorise" class="flex flex-col gap-3">
      <span class="text-sm text-ink-gray-8 font-medium">
        {{
          can.authorise_role === "Second authoriser"
            ? __("Second authoriser's decision (clause 8.3)")
            : __("Your decision")
        }}
      </span>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormControl
          type="select"
          :label="__('Decision')"
          :options="decisionOptions"
          v-model="decision"
        />
        <FormControl
          v-if="needsAmount"
          type="number"
          :label="__('Amount authorised (including VAT)')"
          v-model="amount"
        />
      </div>
      <FormControl
        type="textarea"
        :rows="3"
        :label="
          decision === 'DECLINED'
            ? __('Reason for declining')
            : __('Conditions attached')
        "
        v-model="conditions"
      />
      <SignaturePad v-model="signature" />
      <div class="flex justify-end">
        <Button
          variant="solid"
          :label="__('Sign and record the decision')"
          :disabled="!decision || !signature"
          :loading="busy"
          @click="
            run('authorise', {
              decision,
              amount_authorised: needsAmount ? amount : null,
              conditions,
              image: signature?.image,
              method: signature?.method,
              typed_name: signature?.typed_name,
            })
          "
        />
      </div>
    </div>

    <!-- Load payment: conclude -->
    <div v-if="can.conclude" class="flex flex-col gap-2">
      <div class="flex flex-wrap items-end gap-2">
        <div class="min-w-48 flex-1">
          <FormControl
            type="text"
            :label="__('Payment reference')"
            v-model="paymentReference"
          />
        </div>
        <Button
          variant="solid"
          :label="__('Conclude')"
          :disabled="!ctx.receipt_ready || !paymentReference.trim()"
          :loading="busy"
          @click="
            run('conclude', { payment_reference: paymentReference.trim() })
          "
        />
      </div>
      <p v-if="!ctx.receipt_ready" class="text-p-sm text-ink-gray-6">
        {{
          __(
            "{0} must download the receipt before the request is concluded. It is then emailed to Creditors.",
            ctx.final_approver_name || __("The final approver")
          )
        }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { __ } from "@/translation";
import { Button, createResource, dayjs, FormControl, toast } from "frappe-ui";
import { computed, ref, watch } from "vue";
import LucideCheck from "~icons/lucide/check";
import SignaturePad, { type Signature } from "../ticket/SignaturePad.vue";

const props = defineProps<{ ticketId: string }>();
const emit = defineEmits<{ (e: "changed"): void }>();

const API = "company_helpdesk.procurement_api";
const STAGES = [
  "Awaiting Director",
  "Operations review",
  "Awaiting authorisation",
  "Load payment",
  "Concluded",
];

const context = createResource({
  url: `${API}.get_context`,
  makeParams: () => ({ ticket: props.ticketId }),
  auto: true,
});
watch(
  () => props.ticketId,
  () => context.reload()
);

const ctx = computed(() => context.data || {});
const can = computed(() => ctx.value.can || {});
const stageIndex = computed(() => STAGES.indexOf(ctx.value.stage));

const note = computed(() => {
  const c = ctx.value;
  switch (c.stage) {
    case "Awaiting Director":
      return c.has_uploaded_approval
        ? __(
            "The requester uploaded a signed approval. Check it, then accept it."
          )
        : __(
            "Waiting for {0} to sign the request.",
            c.director || __("the Director")
          );
    case "Awaiting authorisation":
      return c.two_approvers && c.decision
        ? __("Clause 8.3: waiting for a second authoriser.")
        : __("Waiting for the authoriser's decision.");
    case "Load payment":
      return __("Approved. Load the payment, then conclude the request.");
    case "Concluded":
      return __(
        "Concluded. Payment reference: {0}",
        c.payment_reference || "-"
      );
    default:
      return "";
  }
});

// ---- the decision
const decision = ref("");
const amount = ref<number | null>(null);
const conditions = ref("");
const signature = ref<Signature | null>(null);
const authoriser = ref("");
const paymentReference = ref("");

const decisionOptions = computed(() => {
  const values = ["APPROVED", "APPROVED WITH CONDITIONS", "DECLINED"];
  if (can.value.authorise_role === "Authoriser")
    values.push("REFERRED TO BOARD");
  return [
    { label: "", value: "" },
    ...values.map((v) => ({ label: __(v), value: v })),
  ];
});
const needsAmount = computed(
  () =>
    can.value.authorise_role === "Authoriser" &&
    ["APPROVED", "APPROVED WITH CONDITIONS"].includes(decision.value)
);

// ---- the steps: one resource per API method
const METHODS = [
  "accept_uploaded_approval",
  "resend_director_link",
  "send_to_authoriser",
  "authorise",
  "conclude",
];
const steps = Object.fromEntries(
  METHODS.map((method) => [
    method,
    createResource({
      url: `${API}.${method}`,
      onSuccess(data: any) {
        context.data = data;
        decision.value = "";
        conditions.value = "";
        signature.value = null;
        emit("changed");
      },
      onError(error: any) {
        // frappe-ui rejects with an Error; never hand the object to a toast.
        toast.error(
          error?.messages?.[0] || error?.message || __("That did not work.")
        );
      },
    }),
  ])
);
const busy = computed(() => METHODS.some((m) => steps[m].loading));

function run(method: string, params: Record<string, any> = {}) {
  steps[method].submit({ ticket: props.ticketId, ...params });
}

function downloadReceipt() {
  const url = `/api/method/${API}.download_receipt?ticket=${encodeURIComponent(
    props.ticketId
  )}`;
  window.open(url, "_blank");
  // The server stamps the final approver's download; show it once it has.
  setTimeout(() => context.reload(), 3000);
}

function formatWhen(value: string) {
  return value ? dayjs(value).format("D MMM YYYY, HH:mm") : "";
}
</script>
