<template>
  <!-- HLB-FORK: procurement-signature — the Procurement Request's flow on the
       ticket: where it is, who has signed, and the one step open to the person
       looking at it. Every action is a company_helpdesk procurement_api call;
       the server decides who may do what and this only offers what it allows. -->
  <ErrorMessage
    v-if="context.error"
    class="px-4 py-4"
    :message="
      errorText(context.error, __('Could not load the Procurement panel.'))
    "
  />
  <div v-else-if="context.data" class="px-4 py-4 flex flex-col gap-4">
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

    <!-- the steps, from the server -->
    <ol v-if="!ctx.declined" class="flex flex-wrap gap-x-4 gap-y-1">
      <li
        v-for="(step, i) in ctx.steps"
        :key="step"
        class="flex items-center gap-1.5 text-sm"
        :class="
          i === stepIndex
            ? 'text-ink-gray-9 font-medium'
            : i < stepIndex
            ? 'text-ink-gray-6'
            : 'text-ink-gray-4'
        "
      >
        <LucideCheck v-if="i < stepIndex" class="size-3.5" />
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

    <!-- who has it -->
    <dl
      v-if="people.length"
      class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-p-sm"
    >
      <template v-for="p in people" :key="p.label">
        <dt class="text-ink-gray-5">{{ p.label }}</dt>
        <dd class="text-ink-gray-8">{{ p.name }}</dd>
      </template>
    </dl>

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
          class="h-10 w-32 shrink-0 object-contain bg-surface-base"
        />
        <div class="min-w-0 flex-1 text-p-sm">
          <div class="text-ink-gray-8">
            {{ __(s.role) }}: {{ s.signer_name }}
            <span v-if="s.decision" class="text-ink-gray-6"
              >· {{ __(s.decision) }}</span
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

    <!-- Pending verification -->
    <div v-if="can.start_verification">
      <Button
        variant="solid"
        :label="__('Start verification')"
        :loading="busy"
        @click="run('start_verification')"
      />
    </div>

    <!-- Verification in progress: send to an approver, or decline -->
    <div v-if="can.verify" class="flex flex-col gap-3">
      <div class="flex flex-wrap items-end gap-2">
        <div class="min-w-48 flex-1">
          <FormControl
            type="select"
            :label="__('PMO Approver')"
            :options="approverOptions"
            v-model="approver"
          />
        </div>
        <Button
          variant="solid"
          :label="__('Verified: send for review')"
          :disabled="!approver"
          :loading="busy"
          @click="run('verify_approve', { approver })"
        />
      </div>
      <FormControl
        type="textarea"
        :rows="2"
        :label="__('Reason for declining')"
        v-model="reason"
      />
      <div>
        <Button
          theme="red"
          :label="__('Decline')"
          :disabled="!reason.trim()"
          :loading="busy"
          @click="run('verify_decline', { reason: reason.trim() })"
        />
      </div>
    </div>

    <!-- HLB-FORK: procurement-signature — referred to the board: locked, with
         the same approver, until the board decides (2026-10-22). -->
    <div
      v-if="ctx.referred"
      class="rounded border border-outline-gray-2 bg-surface-gray-1 px-3 py-2 text-p-sm text-ink-gray-8"
    >
      {{
        __(
          "Referred to the board. The request is locked until the board has decided."
        )
      }}
    </div>

    <!-- Pending review: decide and sign -->
    <div v-if="can.decide" class="flex flex-col gap-3">
      <span class="text-sm text-ink-gray-8 font-medium">
        {{
          can.decide_role === "Second authoriser"
            ? __("Second approver's decision (clause 8.3)")
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
        <FormControl
          v-if="needsSecond"
          type="select"
          :label="__('Second approver (clause 8.3)')"
          :options="approverOptions"
          v-model="secondApprover"
        />
      </div>
      <FormControl
        type="textarea"
        :rows="3"
        :label="
          needsReason ? __('Reason or conditions (required)') : __('Note')
        "
        v-model="conditions"
      />
      <template v-if="needsBoard">
        <FormControl
          type="textarea"
          :rows="2"
          :label="__('Board decision (required)')"
          v-model="boardDecision"
        />
        <div class="flex flex-col gap-1.5">
          <span class="text-xs text-ink-gray-5">
            {{ __("Board minutes (required)") }}
          </span>
          <div v-if="boardMinutes" class="flex items-center gap-2 text-p-sm">
            <span class="truncate text-ink-gray-8">
              {{ boardMinutes.file_name }}
            </span>
            <Button
              variant="ghost"
              icon="lucide-x"
              :aria-label="__('Remove')"
              @click="boardMinutes = null"
            />
          </div>
          <div v-else>
            <input
              ref="minutesInput"
              type="file"
              class="hidden"
              @change="uploadMinutes"
            />
            <Button
              :label="__('Upload the minutes')"
              icon-left="lucide-upload"
              :loading="uploadingMinutes"
              @click="minutesInput?.click()"
            />
          </div>
        </div>
      </template>
      <SignaturePad :key="padKey" v-model="signature" />
      <div class="flex justify-end">
        <Button
          variant="solid"
          :label="__('Sign and record the decision')"
          :disabled="
            !decision ||
            !signature ||
            (needsSecond && !secondApprover) ||
            (needsReason && !conditions.trim()) ||
            (needsBoard && (!boardDecision.trim() || !boardMinutes))
          "
          :loading="busy"
          @click="
            run('decide', {
              decision,
              amount_authorised: needsAmount ? amount : null,
              conditions,
              second_approver: needsSecond ? secondApprover : null,
              board_decision: needsBoard ? boardDecision.trim() : null,
              board_minutes: needsBoard ? boardMinutes?.file_url : null,
              image: signature?.image,
              method: signature?.method,
              typed_name: signature?.typed_name,
            })
          "
        />
      </div>
    </div>

    <!-- Pending review: refer to the board, after "Are you sure?" -->
    <div v-if="can.refer_to_board">
      <Button
        :label="__('Refer to the board')"
        :loading="busy"
        @click="showReferDialog = true"
      />
      <Dialog
        v-model="showReferDialog"
        :options="{ title: __('Refer to the board?') }"
      >
        <template #body-content>
          <p class="text-p-sm text-ink-gray-6">
            {{
              __(
                "Are you sure? The request stays with you and is locked. When the board has decided, approving it needs the board's decision and the minutes."
              )
            }}
          </p>
        </template>
        <template #actions>
          <div class="flex justify-end gap-2">
            <Button :label="__('No')" @click="showReferDialog = false" />
            <Button
              variant="solid"
              :label="__('Yes, refer it')"
              :loading="busy"
              @click="referToBoard"
            />
          </div>
        </template>
      </Dialog>
    </div>

    <!-- Pending review: send back for more information -->
    <div v-if="can.request_more_info" class="flex flex-col gap-2">
      <FormControl
        type="textarea"
        :rows="2"
        :label="__('What is missing')"
        v-model="moreInfo"
      />
      <div>
        <Button
          :label="__('Send back for more information')"
          :disabled="moreInfo.trim().length < minLength"
          :loading="busy"
          @click="run('request_more_info', { comment: moreInfo.trim() })"
        />
      </div>
    </div>

    <!-- Approved, Processing -->
    <div v-if="can.start_processing">
      <Button
        variant="solid"
        :label="__('Processing')"
        :loading="busy"
        @click="run('start_processing')"
      />
    </div>
    <div v-if="can.mark_loaded">
      <Button
        variant="solid"
        :label="__('Loaded for payment')"
        :loading="busy"
        @click="run('mark_loaded')"
      />
    </div>

    <!-- Loaded for payment: Paid, with a closing comment -->
    <div v-if="can.mark_paid" class="flex flex-col gap-2">
      <FormControl
        type="text"
        :label="__('Payment reference (optional)')"
        v-model="paymentReference"
      />
      <FormControl
        type="textarea"
        :rows="2"
        :label="__('Closing comment')"
        v-model="closingComment"
      />
      <div>
        <Button
          variant="solid"
          :label="__('Mark paid')"
          :disabled="closingComment.trim().length < minLength"
          :loading="busy"
          @click="
            run('mark_paid', {
              comment: closingComment.trim(),
              payment_reference: paymentReference.trim(),
            })
          "
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { __ } from "@/translation";
import { errorText, uploadFunction } from "@/utils";
import {
  Button,
  createResource,
  dayjs,
  Dialog,
  ErrorMessage,
  FormControl,
  toast,
} from "frappe-ui";
import { computed, ref, watch } from "vue";
import LucideCheck from "~icons/lucide/check";
import SignaturePad, { type Signature } from "../ticket/SignaturePad.vue";

const props = defineProps<{ ticketId: string }>();
const emit = defineEmits<{ (e: "changed"): void }>();

const API = "company_helpdesk.procurement_api";

const context = createResource({
  url: `${API}.get_context`,
  makeParams: () => ({ ticket: props.ticketId }),
  auto: true,
});
watch(
  () => props.ticketId,
  () => {
    resetForm();
    context.reload();
  }
);

const ctx = computed(() => context.data || {});
const can = computed(() => ctx.value.can || {});
const stepIndex = computed(() =>
  (ctx.value.steps || []).indexOf(ctx.value.status)
);
const minLength = computed(() => ctx.value.close_comment_min_length || 1);

const people = computed(() =>
  [
    { label: __("Verified by"), person: ctx.value.verifier },
    { label: __("First approver"), person: ctx.value.first_approver },
    { label: __("Second approver"), person: ctx.value.second_approver },
  ]
    .filter((p) => p.person)
    .map((p) => ({ label: p.label, name: p.person.name }))
);

const approverOptions = computed(() => [
  { label: "", value: "" },
  ...(ctx.value.approvers || []).map((a: { user: string; name: string }) => ({
    label: a.name,
    value: a.user,
  })),
]);

// ---- the decision
const decision = ref("");
const amount = ref<number | null>(null);
const conditions = ref("");
const signature = ref<Signature | null>(null);
const secondApprover = ref("");
const approver = ref("");
const reason = ref("");
const moreInfo = ref("");
const closingComment = ref("");
const paymentReference = ref("");
const boardDecision = ref("");
const boardMinutes = ref<{ file_url: string; file_name: string } | null>(null);
const uploadingMinutes = ref(false);
const minutesInput = ref<HTMLInputElement | null>(null);
const showReferDialog = ref(false);
// A fresh pad after each step: the pad keeps its own canvas and typed name.
const padKey = ref(0);

function resetForm() {
  decision.value = "";
  amount.value = null;
  conditions.value = "";
  signature.value = null;
  secondApprover.value = "";
  approver.value = "";
  reason.value = "";
  moreInfo.value = "";
  closingComment.value = "";
  paymentReference.value = "";
  boardDecision.value = "";
  boardMinutes.value = null;
  showReferDialog.value = false;
  padKey.value += 1;
}

// Each decision comes from the server with what it needs (amount, reason,
// second approver), so no rule is repeated here.
type DecisionOption = {
  value: string;
  needs_amount: boolean;
  needs_reason: boolean;
  needs_second: boolean;
  needs_board: boolean;
};
const decisionOptions = computed(() => [
  { label: "", value: "" },
  ...(can.value.decisions || []).map((d: DecisionOption) => ({
    label: __(d.value),
    value: d.value,
  })),
]);
const chosen = computed<DecisionOption | undefined>(() =>
  (can.value.decisions || []).find(
    (d: DecisionOption) => d.value === decision.value
  )
);
const needsAmount = computed(() => Boolean(chosen.value?.needs_amount));
const needsReason = computed(() => Boolean(chosen.value?.needs_reason));
const needsSecond = computed(() => Boolean(chosen.value?.needs_second));
const needsBoard = computed(() => Boolean(chosen.value?.needs_board));

// The minutes are uploaded unattached; the server attaches them on the decision.
async function uploadMinutes(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  uploadingMinutes.value = true;
  try {
    boardMinutes.value = (await uploadFunction(file)) as {
      file_url: string;
      file_name: string;
    };
  } catch (err: any) {
    toast.error(errorText(err, __("Upload failed")));
  } finally {
    uploadingMinutes.value = false;
  }
}

function referToBoard() {
  run("refer_to_board");
}

// ---- the steps: one resource per API method
const METHODS = [
  "start_verification",
  "verify_approve",
  "verify_decline",
  "decide",
  "request_more_info",
  "refer_to_board",
  "start_processing",
  "mark_loaded",
  "mark_paid",
];
const steps = Object.fromEntries(
  METHODS.map((method) => [
    method,
    createResource({
      url: `${API}.${method}`,
      onSuccess(data: any) {
        context.data = data;
        resetForm();
        emit("changed");
      },
      onError(error: any) {
        toast.error(errorText(error, __("That did not work.")));
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
}

function formatWhen(value: string) {
  return value ? dayjs(value).format("D MMM YYYY, HH:mm") : "";
}
</script>
