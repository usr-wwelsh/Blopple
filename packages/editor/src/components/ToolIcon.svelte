<script lang="ts">
  import type { Tool } from "../lib/toolStore.svelte";

  let { tool }: { tool: Tool } = $props();
</script>

<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  {#if tool === "wall"}
    <rect x="2" y="2" width="20" height="20" rx="1" opacity=".3" stroke-dasharray="2 2" />
    <rect x="2" y="2" width="5" height="20" fill="currentColor" stroke="none" />
  {:else if tool === "floor"}
    <rect x="2" y="2" width="20" height="20" rx="1" opacity=".3" stroke-dasharray="2 2" />
    <rect x="2" y="17" width="20" height="5" fill="currentColor" stroke="none" />
  {:else if tool === "ceiling"}
    <rect x="2" y="2" width="20" height="20" rx="1" opacity=".3" stroke-dasharray="2 2" />
    <rect x="2" y="2" width="20" height="5" fill="currentColor" stroke="none" />
  {:else if tool === "door"}
    <rect x="2" y="2" width="20" height="20" rx="1" opacity=".3" stroke-dasharray="2 2" />
    <rect x="2" y="2" width="5" height="7" fill="currentColor" stroke="none" />
    <rect x="2" y="15" width="5" height="7" fill="currentColor" stroke="none" />
    <path d="M7 9 A7 7 0 0 1 14 16" stroke-dasharray="1.5 1.5" opacity=".6" />
    <line x1="7" y1="9" x2="7" y2="16" />
  {:else if tool === "key"}
    <circle cx="7" cy="8" r="4" />
    <line x1="10.5" y1="11" x2="19" y2="19.5" />
    <line x1="14.5" y1="15" x2="14.5" y2="18" />
    <line x1="17" y1="17.5" x2="17" y2="19.5" />
  {:else if tool === "weapon"}
    <circle cx="12" cy="12" r="7" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
  {:else if tool === "enemy"}
    <circle cx="12" cy="10" r="7" />
    <circle cx="9.2" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="14.8" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
    <path d="M8 15.5 V19 M12 16 V20.5 M16 15.5 V19" />
  {:else if tool === "exit"}
    <rect x="3" y="3" width="12" height="18" rx="1" />
    <path d="M9 12 H21" />
    <path d="M16.5 8 L21 12 L16.5 16" />
  {:else if tool === "height"}
    <path d="M12 3 L21 7.5 L12 12 L3 7.5 Z" />
    <path d="M3 12 L12 16.5 L21 12" />
    <path d="M3 16.5 L12 21 L21 16.5" />
  {:else if tool === "playerStart"}
    <line x1="5" y1="3" x2="5" y2="21" />
    <path d="M5 4 H18 L14 8 L18 12 H5 Z" fill="currentColor" stroke="none" opacity=".9" />
  {:else if tool === "erase"}
    <rect x="4" y="10" width="16" height="8" rx="1.5" transform="rotate(-18 12 14)" />
    <line x1="9" y1="9" x2="9" y2="19" transform="rotate(-18 12 14)" opacity=".5" />
  {/if}
</svg>

<style>
  .icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }
</style>
