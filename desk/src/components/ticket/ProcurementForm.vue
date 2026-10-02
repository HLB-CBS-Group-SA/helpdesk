<template>
  <!-- HLB-FORK: procurement-form — the expenditure requisition, laid out as
       the paper form (sections A to G). The fields are company_helpdesk's pr_*
       Custom Fields on the Default template: labels, options, when a field
       shows and when it is required all come from `fields` (parsed from the
       Custom Fields' depends_on / mandatory_depends_on), so this file only
       decides layout and input behaviour. The server recomputes every figure
       shown here (company_helpdesk setup/procurement.py). -->
  <div class="flex flex-col gap-6">
    <section v-for="section in sections" :key="section.title">
      <h3 class="text-base-medium text-ink-gray-8 mb-3">
        {{ section.title }}
      </h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <template v-for="name in section.fields" :key="name">
          <div
            v-if="show(name)"
            :class="{
              'sm:col-span-2': WIDE.has(name),
              'sm:col-start-1': ROW_START.has(name),
            }"
          >
            <span
              v-if="!CHECKBOX.has(name)"
              class="mb-1.5 block text-sm text-ink-gray-7"
            >
              {{ label(name) }}
              <span v-if="required(name)" class="text-ink-red-6">*</span>
            </span>

            <!-- amounts: 100 000 000.00; the exchange rate to 4 places -->
            <FormControl
              v-if="name in DECIMALS"
              type="text"
              inputmode="decimal"
              :model-value="moneyShown(name)"
              @update:model-value="(v) => setMoney(name, v)"
              @change="() => delete drafts[name]"
            />
            <FormControl
              v-else-if="name === 'pr_supplier_phone'"
              type="tel"
              :placeholder="placeholder(name)"
              :model-value="doc[name]"
              @update:model-value="(v) => set(name, formatPhone(v))"
            />
            <FormControl
              v-else-if="TEXTAREA.has(name)"
              type="textarea"
              :rows="name === 'pr_reason' ? 6 : 4"
              :placeholder="placeholder(name)"
              :model-value="doc[name]"
              @update:model-value="(v) => set(name, v)"
            />
            <FormControl
              v-else-if="meta[name]?.fieldtype === 'Select'"
              type="select"
              :options="selectOptions(name)"
              :model-value="doc[name]"
              @update:model-value="(v) => setSelect(name, v)"
            />
            <DatePicker
              v-else-if="meta[name]?.fieldtype === 'Date'"
              :format="dateFormat"
              :value="doc[name]"
              :model-value="doc[name]"
              @update:model-value="(v) => set(name, v)"
              @change="(v) => set(name, v?.target?.value ?? v?.value ?? v)"
            />
            <Link
              v-else-if="meta[name]?.fieldtype === 'Link'"
              :doctype="meta[name].options"
              :page-length="999"
              :model-value="doc[name]"
              @update:model-value="(v) => set(name, v)"
            />
            <FormControl
              v-else-if="CHECKBOX.has(name)"
              type="checkbox"
              :label="label(name)"
              :model-value="Boolean(doc[name])"
              @update:model-value="(v) => set(name, v ? 1 : 0)"
            />
            <div v-else-if="name === 'pr_director_approval'">
              <FileList
                :files="approvalFile ? [approvalFile] : []"
                @remove="removeApproval"
              />
              <Button
                v-if="!approvalFile"
                :label="__('Upload signed approval')"
                icon-left="lucide-upload"
                :loading="uploading > 0"
                @click="approvalInput?.click()"
              />
            </div>
            <FormControl
              v-else
              type="text"
              :placeholder="placeholder(name)"
              :disabled="disabled(name)"
              :model-value="doc[name]"
              @update:model-value="(v) => set(name, v)"
            />

            <!-- the quotation files, under "Quotations attached" -->
            <div v-if="name === 'pr_quotations'" class="mt-2">
              <FileList :files="quotationFiles" @remove="removeQuotation" />
              <Button
                :label="__('Upload quotations')"
                icon-left="lucide-upload"
                :loading="uploading > 0"
                @click="quotationInput?.click()"
              />
            </div>
          </div>
        </template>
      </div>

      <!-- the worked-out figures, under section C -->
      <div
        v-if="section.figures && figures"
        class="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 rounded border border-outline-gray-2 bg-surface-gray-1 px-3 py-2 text-p-sm sm:grid-cols-4"
      >
        <template v-for="row in figures" :key="row.label">
          <span class="text-ink-gray-6">{{ row.label }}</span>
          <span class="text-ink-gray-8 tabular-nums">{{ row.value }}</span>
        </template>
      </div>
      <p
        v-if="section.figures && twoApprovers"
        class="mt-3 text-p-sm text-ink-gray-6"
      >
        {{
          __(
            "An agreement that renews automatically, or runs for longer than 12 months, needs two Designated Expense Approvers (clause 8.3)."
          )
        }}
      </p>
      <p
        v-if="section.lateNotice && lateBy"
        class="mt-3 text-p-sm text-ink-gray-6"
      >
        {{
          __(
            "Clause 7.3 asks for this form {0} business days before the payment date. You can still submit it; the approver will see that it is inside the lead time.",
            lateBy
          )
        }}
      </p>
      <p
        v-if="section.lateNotice && payRunNote"
        class="mt-3 text-p-sm text-ink-gray-6"
      >
        {{ payRunNote }}
      </p>
      <p v-if="section.declarant" class="mt-3 text-p-sm text-ink-gray-6">
        {{ __("Requester: {0}, {1}", userName, todayShown) }}
      </p>
    </section>

    <input
      ref="quotationInput"
      type="file"
      multiple
      class="hidden"
      @change="(e) => pick(e, addQuotation)"
    />
    <input
      ref="approvalInput"
      type="file"
      class="hidden"
      @change="(e) => pick(e, setApproval)"
    />
  </div>
</template>

<script setup lang="ts">
import { Link } from "@/components";
import { useAuthStore } from "@/stores/auth";
import { __ } from "@/translation";
import { Field } from "@/types";
import { uploadFunction } from "@/utils";
import {
  Button,
  createResource,
  DatePicker,
  FormControl,
  toast,
} from "frappe-ui";
import { storeToRefs } from "pinia";
import { computed, defineComponent, h, onMounted, ref, watch } from "vue";

type UploadedFile = { name: string; file_name: string; file_url: string };

const props = defineProps<{
  doc: Record<string, any>;
  fields: Field[];
  files: UploadedFile[];
}>();
const emit = defineEmits<{
  (e: "update:files", files: UploadedFile[]): void;
  (e: "update:subject", subject: string): void;
}>();

const { userName } = storeToRefs(useAuthStore());

// Section order and grouping follow the paper form. A field listed here
// that the template does not carry is simply not drawn.
const sections = [
  {
    title: __("A. Requester and entity"),
    fields: [
      "pr_request_date",
      "pr_entity",
      "pr_cost_category",
      "pr_other_specify",
    ],
  },
  {
    title: __("B. Goods or services required"),
    fields: [
      "pr_goods_description",
      "pr_supplier",
      "pr_supplier_approved",
      "pr_supplier_contact",
      "pr_supplier_phone",
      "pr_quotations",
      "pr_supplier_motivation",
    ],
  },
  {
    title: __("C. Cost, frequency and committed term"),
    figures: true,
    fields: [
      "pr_currency",
      "pr_currency_other",
      "pr_exchange_rate",
      "pr_amount_basis",
      "pr_amount",
      "pr_vat_rate",
      "pr_frequency",
      "pr_frequency_other",
      "pr_periods",
      "pr_term_from",
      "pr_term_to",
      "pr_notice_unit",
      "pr_notice_period",
      "pr_renewal_date",
      "pr_auto_renew",
    ],
  },
  {
    title: __("D. Supplier terms and when payment is required"),
    lateNotice: true,
    fields: [
      "pr_payment_terms",
      "pr_payment_terms_other",
      "pr_deposit",
      "pr_deposit_amount",
      "pr_payment_date",
      "pr_payment_day",
      "pr_out_of_cycle",
      "pr_out_of_cycle_reason",
    ],
  },
  {
    title: __("E. Reason for the cost and benefit to the Group"),
    fields: ["pr_reason"],
  },
  {
    title: __("F. Budget and conflict of interest"),
    fields: [
      "pr_budgeted",
      "pr_budget_line",
      "pr_budget_motivation",
      "pr_conflict",
      "pr_conflict_details",
    ],
  },
  {
    title: __("G. Declaration"),
    declarant: true,
    fields: [
      "pr_declaration",
      "pr_director",
      "pr_director_designation",
      "pr_director_approval",
    ],
  },
];

const WIDE = new Set([
  "pr_cost_category",
  "pr_goods_description",
  "pr_supplier_motivation",
  "pr_out_of_cycle_reason",
  "pr_reason",
  "pr_budget_motivation",
  "pr_conflict",
  "pr_conflict_details",
  "pr_declaration",
  "pr_director_approval",
  "pr_quotations",
]);
const TEXTAREA = new Set([
  "pr_goods_description",
  "pr_supplier_motivation",
  "pr_out_of_cycle_reason",
  "pr_reason",
  "pr_budget_motivation",
  "pr_conflict_details",
]);
// Typed as decimals, shown with spaced thousands; the value is the places kept.
const DECIMALS: Record<string, number> = {
  pr_amount: 2,
  pr_deposit_amount: 2,
  pr_exchange_rate: 4,
};
// Each starts a new row on a wide screen, so its pair sits side by side.
const ROW_START = new Set(["pr_term_from", "pr_notice_unit"]);
// The notice period's unit comes first; Days are work days (#92).
const OPTION_LABELS: Record<string, Record<string, string>> = {
  pr_notice_unit: { Days: "Work days" },
};
const CALENDAR_MONTH = "Calendar Month";
const PER_USAGE = "Per usage / variable";
const CHECKBOX = new Set(["pr_declaration"]);

const meta = computed<Record<string, any>>(() =>
  Object.fromEntries(props.fields.map((f) => [f.fieldname, f]))
);

function show(name: string): boolean {
  return Boolean(meta.value[name]?.display_via_depends_on);
}
function required(name: string): boolean {
  return Boolean(meta.value[name]?.required);
}
function label(name: string): string {
  // Per usage / variable: the amount is a monthly cap (#92).
  if (name === "pr_amount" && props.doc.pr_frequency === PER_USAGE) {
    return __("Maximum per month (cap)");
  }
  return __(meta.value[name]?.label || name);
}
function placeholder(name: string): string {
  return meta.value[name]?.placeholder ? __(meta.value[name].placeholder) : "";
}
function selectOptions(name: string) {
  const values = (meta.value[name]?.options || "").split("\n").filter(Boolean);
  return [
    { label: "", value: "" },
    ...values.map((v: string) => ({
      label: __(OPTION_LABELS[name]?.[v] || v),
      value: v,
    })),
  ];
}
function set(name: string, value: any) {
  props.doc[name] = value;
}
function setSelect(name: string, value: any) {
  set(name, value);
  // A calendar month's notice has no number: it is always the one month.
  if (name === "pr_notice_unit" && value === CALENDAR_MONTH) {
    set("pr_notice_period", "");
  }
}
function disabled(name: string): boolean {
  return (
    name === "pr_notice_period" && props.doc.pr_notice_unit === CALENDAR_MONTH
  );
}

const dateFormat = (window as any).date_format?.toUpperCase() || "DD-MM-YYYY";
const today = new Date();
const todayIso = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");
const todayShown = today.toLocaleDateString();

// Sensible starting answers; every one can be changed.
onMounted(() => {
  const defaults: Record<string, string> = {
    pr_request_date: todayIso,
    pr_currency: "ZAR",
    pr_amount_basis: "Excluding VAT",
    pr_vat_rate: "15%",
  };
  for (const [name, value] of Object.entries(defaults)) {
    if (!props.doc[name]) props.doc[name] = value;
  }
});

// ---- amounts: typed freely, shown as 100 000 000.00 once the field is left
// (the input's change event, which fires on blur). While typing, the draft is
// shown as typed, so the cursor never jumps.
const drafts = ref<Record<string, string>>({});

function formatMoney(value: any, places = 2): string {
  if (value === "" || value === null || value === undefined) return "";
  const n = Number(value);
  if (Number.isNaN(n)) return "";
  const [whole, cents] = n.toFixed(places).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${cents}`;
}
function moneyShown(name: string): string {
  return drafts.value[name] ?? formatMoney(props.doc[name], DECIMALS[name]);
}
function setMoney(name: string, typed: string) {
  let clean = String(typed ?? "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  const [whole, ...rest] = clean.split(".");
  if (rest.length) {
    clean = `${whole}.${rest.join("").slice(0, DECIMALS[name] ?? 2)}`;
  }
  drafts.value[name] = clean;
  props.doc[name] = clean === "" || clean === "." ? "" : Number(clean);
}

// ---- phone: +27 (0) 11 345 6789 as it is typed
function formatPhone(typed: string): string {
  const value = String(typed ?? "");
  const digits = value.replace(/\D/g, "");
  // A foreign number is kept as typed; the server checks its shape.
  if (value.trim().startsWith("+") && !digits.startsWith("27")) return value;
  let national = digits.startsWith("27") ? digits.slice(2) : digits;
  national = national.replace(/^0/, "").slice(0, 9);
  if (!national) return digits.startsWith("27") ? "+27 (0) " : value;
  const parts = [national.slice(0, 2), national.slice(2, 5), national.slice(5)];
  return `+27 (0) ${parts.filter(Boolean).join(" ")}`;
}

// ---- the worked-out figures (the server's formulas, for display only)
const VAT_RATES: Record<string, number> = { "15%": 0.15, "0%": 0 };
const MONTHS: Record<string, number> = {
  Monthly: 1,
  Quarterly: 3,
  "Bi-annual": 6,
  Annual: 12,
};

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function termMonths(): number {
  const start = parseDate(props.doc.pr_term_from);
  const end = parseDate(props.doc.pr_term_to);
  if (!start || !end || end < start) return 0;
  const after = new Date(end);
  after.setDate(after.getDate() + 1);
  let months =
    (after.getFullYear() - start.getFullYear()) * 12 +
    (after.getMonth() - start.getMonth());
  if (after.getDate() > start.getDate()) months += 1;
  return Math.max(months, 1);
}
// Whole months in the committed term: how many times a month fits (#92).
// termMonths (a part month counts) is for clause 8.3 only.
function wholeMonths(): number {
  const start = parseDate(props.doc.pr_term_from);
  const end = parseDate(props.doc.pr_term_to);
  if (!start || !end || end < start) return 0;
  const after = new Date(end);
  after.setDate(after.getDate() + 1);
  let months =
    (after.getFullYear() - start.getFullYear()) * 12 +
    (after.getMonth() - start.getMonth());
  if (after.getDate() < start.getDate()) months -= 1;
  return months;
}
function periods(): number {
  const frequency = props.doc.pr_frequency;
  if (!frequency || frequency === "Once-off") return 1;
  if (MONTHS[frequency]) {
    return Math.max(Math.floor(wholeMonths() / MONTHS[frequency]), 1);
  }
  if (frequency === PER_USAGE) {
    // The amount is the monthly cap, so every month of the term counts.
    return Math.max(wholeMonths(), 1);
  }
  if (frequency === "Weekly") {
    const start = parseDate(props.doc.pr_term_from);
    const end = parseDate(props.doc.pr_term_to);
    if (!start || !end || end < start) return 1;
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    return Math.max(Math.floor(days / 7), 1);
  }
  return Math.max(Number(props.doc.pr_periods) || 1, 1);
}

const currency = computed(() =>
  props.doc.pr_currency === "Other"
    ? props.doc.pr_currency_other || ""
    : props.doc.pr_currency || ""
);

// A cost in another currency has no VAT; it is also shown in rand (#92).
const foreign = computed(
  () => Boolean(props.doc.pr_currency) && props.doc.pr_currency !== "ZAR"
);
const round = (n: number) => Math.round(n * 100) / 100;

const totals = computed(() => {
  const amount = Number(props.doc.pr_amount);
  if (props.doc.pr_amount === "" || Number.isNaN(amount)) return null;
  const rate = foreign.value ? 0 : VAT_RATES[props.doc.pr_vat_rate] ?? 0.15;
  let excl: number, vat: number, total: number;
  if (!foreign.value && props.doc.pr_amount_basis === "Including VAT") {
    total = round(amount);
    excl = round(amount / (1 + rate));
    vat = round(total - excl);
  } else {
    excl = round(amount);
    vat = round(amount * rate);
    total = round(excl + vat);
  }
  return { excl, vat, total, term: round(total * periods()) };
});

// "Total Commitment (12 months)": the periods counted, in the frequency's own
// unit. Per usage counts months at the cap; Other says "payments".
const PERIOD_LABELS: Record<string, [string, string]> = {
  Monthly: ["1 month", "{0} months"],
  Quarterly: ["1 quarter", "{0} quarters"],
  "Bi-annual": ["1 half-year", "{0} half-years"],
  Annual: ["1 year", "{0} years"],
  Weekly: ["1 week", "{0} weeks"],
};
function periodsShown(): string {
  const frequency = props.doc.pr_frequency;
  if (!frequency || frequency === "Once-off") return __("once-off");
  const n = periods();
  const unit = frequency === PER_USAGE ? "Monthly" : frequency;
  const [one, many] = PERIOD_LABELS[unit] || [
    "1 payment",
    "{0} payments",
  ];
  return n === 1 ? __(one) : __(many, n);
}
// "Excluding VAT (Monthly)": the amount is per period of a regular frequency.
function perPeriod(): string {
  const frequency = props.doc.pr_frequency;
  if (frequency === PER_USAGE) return ` (${__("monthly cap")})`;
  return PERIOD_LABELS[frequency] ? ` (${__(frequency)})` : "";
}

const figures = computed(() => {
  const t = totals.value;
  if (!t) return null;
  const c = currency.value ? `${currency.value} ` : "";
  const per = perPeriod();
  const count = periodsShown();
  let rows: { label: string; value: string }[];
  if (foreign.value) {
    const exchange = Number(props.doc.pr_exchange_rate) || 0;
    const zar = (n: number) => `ZAR ${formatMoney(round(n * exchange))}`;
    rows = [
      {
        label: __("Amount in {0}", currency.value) + per,
        value: c + formatMoney(t.total),
      },
      { label: __("Amount in ZAR") + per, value: exchange ? zar(t.total) : "" },
      {
        label: __("Total Commitment in {0} ({1})", currency.value, count),
        value: c + formatMoney(t.term),
      },
      {
        label: __("Total Commitment in ZAR ({0})", count),
        value: exchange ? zar(t.term) : "",
      },
    ];
  } else {
    rows = [
      { label: __("Excluding VAT") + per, value: c + formatMoney(t.excl) },
      { label: __("VAT"), value: c + formatMoney(t.vat) },
      { label: __("Including VAT") + per, value: c + formatMoney(t.total) },
      {
        label: __("Total Commitment (incl VAT) ({0})", count),
        value: c + formatMoney(t.term),
      },
    ];
  }
  if (cancelBy.value) {
    rows.push({ label: __("Cancel / Renew by"), value: cancelBy.value });
  }
  return rows;
});

// Cancel / renew by: 5 work days before the notice must reach the supplier.
// Weekends only here; the server also skips public holidays, and keeps its
// date on the ticket (company_helpdesk setup/procurement.py, cancel_by).
function workDaysBefore(day: Date, count: number): Date {
  const d = new Date(day);
  while (count > 0) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count -= 1;
  }
  return d;
}
function monthsBefore(day: Date, months: number): Date {
  const first = new Date(day.getFullYear(), day.getMonth() - months, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(
    first.getFullYear(),
    first.getMonth(),
    Math.min(day.getDate(), last)
  );
}
// The renewal date, or else the day after the committed term ends.
function decisionDate(): Date | null {
  const renewal = parseDate(props.doc.pr_renewal_date);
  if (renewal) return renewal;
  const end = parseDate(props.doc.pr_term_to);
  if (!end) return null;
  end.setDate(end.getDate() + 1);
  return end;
}
const cancelBy = computed<string>(() => {
  const renewal = decisionDate();
  const frequency = props.doc.pr_frequency;
  if (!renewal || !frequency || frequency === "Once-off") return "";
  const unit = props.doc.pr_notice_unit;
  const notice = Number(props.doc.pr_notice_period) || 0;
  let noticeBy = renewal;
  if (unit === CALENDAR_MONTH) {
    // A whole calendar month before the renewal date's month.
    noticeBy = new Date(renewal.getFullYear(), renewal.getMonth() - 1, 1);
  } else if (unit === "Months" && notice) {
    noticeBy = monthsBefore(renewal, notice);
  } else if (unit === "Days" && notice) {
    noticeBy = workDaysBefore(renewal, notice);
  }
  return workDaysBefore(noticeBy, 5).toLocaleDateString();
});

const twoApprovers = computed(
  () => props.doc.pr_auto_renew === "Yes" || termMonths() > 12
);

// Clause 7.3. Weekends only here; the server also skips public holidays.
const lateBy = computed<number>(() => {
  const start = parseDate(props.doc.pr_request_date);
  const end = parseDate(props.doc.pr_payment_date);
  if (!start || !end) return 0;
  const recurring = !["", "Once-off", undefined].includes(
    props.doc.pr_frequency
  );
  const foreign = (props.doc.pr_currency || "ZAR") !== "ZAR";
  const large = (totals.value?.total || 0) > 25000;
  const needed = recurring || foreign || large ? 10 : 5;
  let days = 0;
  const day = new Date(start);
  while (day < end) {
    day.setDate(day.getDate() + 1);
    if (day.getDay() !== 0 && day.getDay() !== 6) days += 1;
  }
  return days < needed ? needed : 0;
});

// ---- the creditors run (#92). A request fully approved by the month's
// accounts cut-off (site config, the 25th by default) goes with that month's
// creditors. The server says which run, for a request approved today, and
// whether the payment date is before its release. The release date itself is
// internal and never shown.
const payRun = createResource({
  url: "company_helpdesk.procurement_api.pay_run",
  method: "GET",
});
watch(
  () => props.doc.pr_payment_date,
  (paymentDate) => payRun.fetch({ payment_date: paymentDate || null }),
  { immediate: true }
);
const payRunNote = computed<string>(() => {
  const run = payRun.data;
  // An out-of-cycle payment is released on its own, once approved.
  if (!run || props.doc.pr_out_of_cycle === "Yes") return "";
  const cutoff = parseDate(run.cutoff);
  if (!cutoff) return "";
  const note = __(
    "To be paid with the creditors of {0}, the request must be fully approved by the accounts cut-off on {1}. Approved later, it goes with the next month's.",
    cutoff.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    cutoff.toLocaleDateString()
  );
  if (!run.out_of_cycle_needed) return note;
  return `${note} ${__(
    "The payment is due before those creditors are paid, so it needs an out-of-cycle payment: answer Yes below and motivate it, or ask Finance for an exception."
  )}`;
});

// ---- the subject, made from the request (#92):
//   [payment date] [entity] [Once-off: R6 000.00] (Budgeted)
// so the operations manager reads the priority without opening the ticket.
// The server makes the same subject on save (company_helpdesk
// setup/procurement.py, set_subject); this is the preview the requester sees.
const ENTITY_PREFIXES = [
  "HLB CBS GROUP (SOUTH AFRICA) ",
  "HLB CBS GROUP SOUTH AFRICA ",
];
function dateShown(value: string): string {
  const d = parseDate(value);
  if (!d) return "";
  return dateFormat
    .replace("DD", String(d.getDate()).padStart(2, "0"))
    .replace("MM", String(d.getMonth() + 1).padStart(2, "0"))
    .replace("YYYY", String(d.getFullYear()));
}
const subjectLine = computed<string>(() => {
  const parts: string[] = [];
  const due = dateShown(props.doc.pr_payment_date);
  if (due) parts.push(due);
  let entity = String(props.doc.pr_entity || "").trim();
  const prefix = ENTITY_PREFIXES.find((p) =>
    entity.toUpperCase().startsWith(p)
  );
  if (prefix) entity = entity.slice(prefix.length);
  if (entity) parts.push(entity);
  const frequency = props.doc.pr_frequency || "Once-off";
  if (totals.value) {
    const c = currency.value || "ZAR";
    const amount = formatMoney(totals.value.total);
    parts.push(
      `${frequency}: ${c === "ZAR" ? `R${amount}` : `${c} ${amount}`}`
    );
  } else if (props.doc.pr_frequency) {
    parts.push(frequency);
  }
  if (props.doc.pr_budgeted === "Yes") parts.push("(Budgeted)");
  return parts.join(" ").slice(0, 140);
});
watch(subjectLine, (line) => emit("update:subject", line), {
  immediate: true,
});

// ---- uploads: onto the new ticket, with the rest of its attachments
const quotationInput = ref<HTMLInputElement>();
const approvalInput = ref<HTMLInputElement>();
const uploading = ref(0);
const quotationFiles = ref<UploadedFile[]>([]);
const approvalFile = ref<UploadedFile | null>(null);

function publish() {
  emit("update:files", [
    ...quotationFiles.value,
    ...(approvalFile.value ? [approvalFile.value] : []),
  ]);
}
async function pick(event: Event, done: (f: UploadedFile) => void) {
  const input = event.target as HTMLInputElement;
  const chosen = Array.from(input.files || []);
  input.value = "";
  for (const file of chosen) {
    uploading.value += 1;
    try {
      done((await uploadFunction(file)) as UploadedFile);
    } catch (err: any) {
      // frappe-ui rejects with an Error; never hand the object to a toast.
      toast.error(err?.messages?.[0] || err?.message || __("Upload failed"));
    } finally {
      uploading.value -= 1;
    }
  }
}
function addQuotation(f: UploadedFile) {
  quotationFiles.value = [...quotationFiles.value, f];
  publish();
}
function removeQuotation(f: UploadedFile) {
  quotationFiles.value = quotationFiles.value.filter(
    (q) => q.file_url !== f.file_url
  );
  publish();
}
function setApproval(f: UploadedFile) {
  approvalFile.value = f;
  set("pr_director_approval", f.file_url);
  publish();
}
function removeApproval() {
  approvalFile.value = null;
  set("pr_director_approval", "");
  publish();
}

const FileList = defineComponent({
  props: { files: { type: Array, required: true } },
  emits: ["remove"],
  setup(p, { emit: send }) {
    return () =>
      p.files.length
        ? h(
            "ul",
            { class: "mb-2 flex flex-col gap-1" },
            (p.files as UploadedFile[]).map((f) =>
              h(
                "li",
                {
                  key: f.file_url,
                  class:
                    "flex items-center gap-2 rounded bg-surface-gray-2 px-2 py-1 text-p-sm text-ink-gray-7",
                },
                [
                  h("span", { class: "truncate flex-1" }, f.file_name),
                  h(Button, {
                    variant: "ghost",
                    size: "sm",
                    icon: "x",
                    "aria-label": __("Remove"),
                    onClick: () => send("remove", f),
                  }),
                ]
              )
            )
          )
        : null;
  },
});
</script>
