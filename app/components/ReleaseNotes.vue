<template>
  <div class="release-notes-text">
    <component :is="tagFor(block)" v-for="(block, b) in blocks" :key="b">
      <component :is="block.kind === 'list' ? 'li' : 'span'" v-for="(line, l) in block.lines" :key="l">
        <template v-for="(span, s) in line" :key="s">
          <a
            v-if="span.href"
            :href="span.href"
            :class="{ bold: span.bold, code: span.code }"
            @click.prevent="openLink(span.href)"
          >{{ span.text }}</a>
          <span v-else :class="{ bold: span.bold, code: span.code }">{{ span.text }}</span>
        </template>
      </component>
    </component>
  </div>
</template>

<script setup lang="ts">
import { parseReleaseNotes, type NoteBlock } from '~/utils/releaseNotes';

const props = defineProps<{
  notes: string;
}>();

const blocks = computed(() => parseReleaseNotes(props.notes));

const tagFor = (block: NoteBlock) => ({ heading: 'h5', paragraph: 'p', list: 'ul' })[block.kind];

const openLink = (url: string) => {
  if (import.meta.client && window.electronAPI) {
    window.electronAPI.openExternal(url);
  }
};
</script>

<style scoped lang="scss">
.release-notes-text {
  > :first-child {
    margin-top: 0;
  }

  > :last-child {
    margin-bottom: 0;
  }
}

h5 {
  margin: 12px 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

p {
  margin: 0 0 8px;
}

ul {
  margin: 0 0 8px;
  padding-left: 18px;
}

li + li {
  margin-top: 2px;
}

.bold {
  font-weight: 600;
}

span.bold {
  color: var(--color-text-primary);
}

.code {
  font-family: var(--font-mono);
  font-size: 12px;
}

a {
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
