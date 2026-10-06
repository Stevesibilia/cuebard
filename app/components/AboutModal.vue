<template>
  <div class="dialog-overlay" @click.self="close">
    <div class="dialog about-dialog" role="dialog" aria-modal="true" :aria-label="t('dialogs.about')">
      <div class="dialog-header">
        <h3>{{ t('dialogs.about') }}</h3>
        <button class="icon-btn" @click="close" :title="t('actions.close')" :aria-label="t('actions.close')">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <div class="dialog-body">
        <div class="about-header">
          <div class="about-mark">
            <img
              :src="'./assets/icons/cuebard-mark.svg'"
              alt=""
              class="about-logo"
            />
          </div>
          <div class="about-text">
            <h1 class="about-title">CueBard</h1>
            <span v-if="appVersion" class="version-badge">v{{ appVersion }}</span>
            <p class="about-subtitle">{{ t('welcome.subtitle') }}</p>
          </div>
        </div>

        <div class="about-info">
          <p class="about-line">
            <span class="about-label">{{ t('about.maintainedBy') }}</span> Stefano Sibilia
          </p>
          <p class="about-line">
            {{ t('about.basedOn', { project: 'LivePlay', author: t('about.developerName') }) }}
          </p>
          <p class="about-line" v-if="t('translationContributor.name')">
            <span class="about-label">{{ t('translationContributor.title') }}</span>
            <a
              :href="formatContributorLink(t('translationContributor.contributeLink'))"
              class="translator-link"
              @click.prevent="handleContributorLinkClick(t('translationContributor.contributeLink'))"
            >
              {{ t('translationContributor.name') }}
            </a>
          </p>
        </div>

        <div class="about-links">
          <a
            href="https://github.com/Stevesibilia/cuebard"
            class="info-link"
            @click.prevent="openExternal('https://github.com/Stevesibilia/cuebard')"
          >
            <span class="material-symbols-rounded">code</span>
            <span>{{ t('about.githubRepo') }}</span>
          </a>

          <a
            href="https://github.com/tdoukinitsas/liveplay"
            class="info-link"
            @click.prevent="openExternal('https://github.com/tdoukinitsas/liveplay')"
          >
            <span class="material-symbols-rounded">history_edu</span>
            <span>{{ t('about.upstreamRepo') }}</span>
          </a>

          <a
            href="https://www.gnu.org/licenses/agpl-3.0.en.html"
            class="info-link"
            @click.prevent="openExternal('https://www.gnu.org/licenses/agpl-3.0.en.html')"
          >
            <span class="material-symbols-rounded">description</span>
            <span>{{ t('dialogs.license') }}</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  close: []
}>();

const { t } = useLocalization();

// Shown once it arrives; no made-up fallback
const appVersion = ref('');
onMounted(async () => {
  if (import.meta.client && window.electronAPI?.getAppVersion) {
    appVersion.value = await window.electronAPI.getAppVersion();
  }
});


const close = () => {
  emit('close');
};

const openExternal = (url: string) => {
  if (import.meta.client && window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  }
};

// Format contributor link to handle different types (website, email, phone)
const formatContributorLink = (link: string): string => {
  if (!link) return '#';
  
  // If it's an email
  if (link.includes('@') && !link.startsWith('mailto:')) {
    return `mailto:${link}`;
  }
  
  // If it's a phone number (starts with + or contains only numbers and spaces/dashes)
  if (link.match(/^[\+\d\s\-\(\)]+$/)) {
    return `tel:${link.replace(/\s/g, '')}`;
  }
  
  // If it's a URL without protocol, add https://
  if (!link.startsWith('http://') && !link.startsWith('https://') && !link.startsWith('mailto:') && !link.startsWith('tel:')) {
    return `https://${link}`;
  }
  
  return link;
};

// Handle contributor link click
const handleContributorLinkClick = (link: string) => {
  const formattedLink = formatContributorLink(link);
  
  // Everything goes through open-external (the window itself never navigates);
  // it opens http(s) and mailto: links and refuses the rest, tel: included.
  openExternal(formattedLink);
};

// Close on Escape key
onMounted(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
    }
  };
  window.addEventListener('keydown', handleEscape);
  onUnmounted(() => {
    window.removeEventListener('keydown', handleEscape);
  });
});
</script>

<style scoped lang="scss">
@use '~/assets/styles/dialog' as dialog;
@include dialog.base;

.about-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--color-divider);
}

.about-mark {
  width: 64px;
  height: 64px;
  flex: none;
  border-radius: 16px;
  background: var(--color-field);
  display: flex;
  align-items: center;
  justify-content: center;
}

.about-logo {
  width: 46px;
  height: 46px;
  object-fit: contain;
}

.about-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.about-title {
  margin: 0;
  font-family: var(--font-brand);
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  color: var(--color-text-primary);
}

.version-badge {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-text-muted);
}

.about-subtitle {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.about-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.about-line {
  margin: 0;
  color: var(--color-text-primary);
}

.about-label {
  margin-inline-end: 4px;
  color: var(--color-text-muted);

  &::after {
    content: ':';
  }
}

.translator-link {
  color: var(--color-accent);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.about-links {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-link {
  height: var(--size-control-lg);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  background-color: var(--color-field);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-control);
  color: var(--color-text-primary);
  text-decoration: none;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);

  &:hover {
    background-color: var(--color-surface-hover);
    border-color: var(--color-accent);
  }

  .material-symbols-rounded {
    font-size: 18px;
    color: var(--color-text-secondary);
  }
}
</style>
