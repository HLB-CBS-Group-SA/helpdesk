<template>
  <!-- HLB-FORK: procurement-signature — sign by drawing (mouse, finger or
       stylus, through Pointer Events) or by typing a name, which is rendered
       as a signature. Either way the result is one PNG. The signature's weight
       is the record the server keeps beside it (who, when, from where, and a
       hash of what was signed): see company_helpdesk procurement_api.py. -->
  <div class="flex flex-col gap-2">
    <TabButtons
      :buttons="[
        { label: __('Draw'), value: 'Drawn' },
        { label: __('Type'), value: 'Typed' },
      ]"
      :modelValue="method"
      @update:modelValue="switchMethod"
    />
    <FormControl
      v-if="method === 'Typed'"
      type="text"
      :placeholder="__('Your full name')"
      :modelValue="typedName"
      @update:modelValue="typeName"
    />
    <div class="relative rounded border border-outline-gray-3 bg-surface-white">
      <canvas
        ref="canvas"
        class="block w-full touch-none"
        :class="method === 'Drawn' ? 'cursor-crosshair' : ''"
        :style="{ height: `${HEIGHT}px` }"
        :aria-label="__('Signature')"
        @pointerdown="start"
        @pointermove="draw"
        @pointerup="stop"
        @pointerleave="stop"
        @pointercancel="stop"
      />
      <span
        v-if="empty"
        class="pointer-events-none absolute inset-0 flex items-center justify-center text-p-sm text-ink-gray-4"
      >
        {{
          method === "Drawn"
            ? __("Sign here with your mouse, finger or stylus")
            : __("Your typed name appears here as your signature")
        }}
      </span>
    </div>
    <div class="flex justify-end">
      <Button
        variant="ghost"
        size="sm"
        :label="__('Clear')"
        :disabled="empty"
        @click="clear"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { __ } from "@/translation";
import { Button, FormControl, TabButtons } from "frappe-ui";
import { onMounted, ref } from "vue";

export type Signature = {
  image: string;
  method: "Drawn" | "Typed";
  typed_name?: string;
};

const emit = defineEmits<{
  (e: "update:modelValue", value: Signature | null): void;
}>();

const HEIGHT = 140;
const INK = "#1f2328";
const canvas = ref<HTMLCanvasElement>();
const method = ref<"Drawn" | "Typed">("Drawn");
const typedName = ref("");
const empty = ref(true);
let drawing = false;
let last: { x: number; y: number } | null = null;

function context(): CanvasRenderingContext2D | null {
  return canvas.value?.getContext("2d") || null;
}

// Size the drawing surface to the element at the device's pixel ratio, so a
// stylus line is sharp on a high-density screen.
function resize() {
  const el = canvas.value;
  if (!el) return;
  const ratio = window.devicePixelRatio || 1;
  el.width = el.clientWidth * ratio;
  el.height = HEIGHT * ratio;
  const ctx = context();
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
}
onMounted(resize);

function point(e: PointerEvent) {
  const rect = canvas.value!.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function start(e: PointerEvent) {
  if (method.value !== "Drawn") return;
  canvas.value?.setPointerCapture(e.pointerId);
  drawing = true;
  last = point(e);
}

function draw(e: PointerEvent) {
  if (!drawing || !last) return;
  const ctx = context();
  if (!ctx) return;
  const p = point(e);
  // A stylus reports pressure; a mouse reports 0.5 while a button is down.
  ctx.lineWidth = 1.2 + (e.pressure || 0.5) * 2;
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  last = p;
  empty.value = false;
}

function stop() {
  if (!drawing) return;
  drawing = false;
  last = null;
  publish();
}

function wipe() {
  const el = canvas.value;
  const ctx = context();
  if (el && ctx) ctx.clearRect(0, 0, el.width, el.height);
  empty.value = true;
}

function clear() {
  wipe();
  typedName.value = "";
  emit("update:modelValue", null);
}

function switchMethod(value: "Drawn" | "Typed") {
  method.value = value;
  clear();
}

function typeName(value: string) {
  typedName.value = value;
  wipe();
  const name = value.trim();
  const ctx = context();
  if (!name || !ctx || !canvas.value) {
    emit("update:modelValue", null);
    return;
  }
  const width = canvas.value.clientWidth;
  let size = 44;
  ctx.font = `italic ${size}px "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive`;
  while (ctx.measureText(name).width > width - 32 && size > 18) {
    size -= 2;
    ctx.font = `italic ${size}px "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive`;
  }
  ctx.textBaseline = "middle";
  ctx.fillText(name, 16, HEIGHT / 2);
  empty.value = false;
  publish();
}

function publish() {
  if (empty.value || !canvas.value) {
    emit("update:modelValue", null);
    return;
  }
  emit("update:modelValue", {
    image: canvas.value.toDataURL("image/png"),
    method: method.value,
    typed_name: method.value === "Typed" ? typedName.value.trim() : undefined,
  });
}
</script>
