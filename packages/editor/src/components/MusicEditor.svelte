<script lang="ts">
  import SongEditor from "./SongEditor.svelte";
  import SfxEditor from "./SfxEditor.svelte";

  type SubTab = "songs" | "sfx";
  let subTab = $state<SubTab>("songs");
</script>

<div class="music-editor">
  <div class="sub-tabs">
    <button class:active={subTab === "songs"} onclick={() => (subTab = "songs")}>Songs</button>
    <button class:active={subTab === "sfx"} onclick={() => (subTab = "sfx")}>Sound FX</button>
  </div>

  {#if subTab === "songs"}
    <SongEditor />
  {:else}
    <SfxEditor />
  {/if}
</div>

<style>
  .music-editor {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .sub-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem;
    border-bottom: 1px solid #333;
  }
  button {
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.3rem 0.6rem;
    cursor: pointer;
    font: inherit;
  }
  button.active {
    background: #555;
    border-color: #888;
  }
</style>
