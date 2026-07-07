import {
  escapeHtml,
  filterRuns,
  formatDuration,
  groupRunsByDay,
  isLive,
  matchesAnyKeyword,
  normalizeKeyword,
  runnerNames,
  sortEventsNewestFirst,
} from './schedule-utils.js';

const STORAGE_KEY = 'my-gdq:keywords';

/**
 * Root component. Light DOM on purpose so Tailwind utility classes apply.
 * State lives on the instance; rendering is a full innerHTML pass, which is
 * plenty fast for a few hundred rows.
 */
class MyGdqApp extends HTMLElement {
  connectedCallback() {
    this.events = [];
    this.runs = [];
    this.query = '';
    this.keywords = loadKeywords();
    this.keywordsOnly = true;
    this.status = 'loading';
    this.errorMessage = '';
    this.eventId = null;

    this.addEventListener('click', (e) => this.onClick(e));
    this.addEventListener('input', (e) => this.onInput(e));
    this.addEventListener('change', (e) => this.onChange(e));
    this.addEventListener('keydown', (e) => this.onKeydown(e));

    this.render();
    this.loadEvents();
  }

  /** Fetch the event list, pick a default event, then load its runs. */
  async loadEvents() {
    try {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error(`Events request failed (${res.status})`);
      const data = await res.json();
      this.events = sortEventsNewestFirst(data.results || []);
      const fromUrl = Number(new URLSearchParams(location.search).get('event'));
      const known = this.events.some((ev) => ev.id === fromUrl);
      this.eventId = known ? fromUrl : this.events[0]?.id ?? null;
      if (this.eventId == null) throw new Error('No events returned by the tracker.');
      await this.loadRuns();
    } catch (err) {
      this.status = 'error';
      this.errorMessage = err.message;
      this.render();
    }
  }

  /** Fetch runs for the selected event. */
  async loadRuns() {
    this.status = 'loading';
    this.runs = [];
    this.render();
    try {
      const res = await fetch(`/api/runs?event=${this.eventId}`);
      if (!res.ok) throw new Error(`Runs request failed (${res.status})`);
      const data = await res.json();
      this.runs = data.results || [];
      this.status = 'ready';
    } catch (err) {
      this.status = 'error';
      this.errorMessage = err.message;
    }
    this.render();
  }

  /** Add the keyword currently typed in the keyword input, if any. */
  addKeywordFromInput() {
    const input = this.querySelector('[data-keyword-input]');
    const keyword = normalizeKeyword(input?.value);
    if (!keyword || this.keywords.includes(keyword)) {
      if (input) input.value = '';
      return;
    }
    this.keywords.push(keyword);
    saveKeywords(this.keywords);
    this.render();
    this.querySelector('[data-keyword-input]')?.focus();
  }

  onClick(e) {
    if (e.target.closest('[data-add-keyword]')) {
      this.addKeywordFromInput();
      return;
    }
    const remove = e.target.closest('[data-remove-keyword]');
    if (remove) {
      this.keywords = this.keywords.filter((k) => k !== remove.dataset.removeKeyword);
      saveKeywords(this.keywords);
      this.render();
      return;
    }
    if (e.target.closest('[data-show-all]')) {
      this.keywordsOnly = false;
      this.render();
    }
  }

  onKeydown(e) {
    if (e.target.matches('[data-keyword-input]') && e.key === 'Enter') {
      e.preventDefault();
      this.addKeywordFromInput();
    }
  }

  onInput(e) {
    if (e.target.matches('[data-search]')) {
      this.query = e.target.value;
      this.renderList();
    }
  }

  onChange(e) {
    if (e.target.matches('[data-event-select]')) {
      this.eventId = Number(e.target.value);
      const url = new URL(location.href);
      url.searchParams.set('event', String(this.eventId));
      history.replaceState(null, '', url);
      this.loadRuns();
    }
    if (e.target.matches('[data-keywords-only]')) {
      this.keywordsOnly = e.target.checked;
      this.renderList();
    }
  }

  render() {
    this.innerHTML = `
      <header class="sticky top-0 z-10 border-b border-line bg-pitch/95 backdrop-blur">
        <div class="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
          <h1 class="text-lg font-bold tracking-widest text-live">MY GDQ</h1>
          <select data-event-select
            class="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-live">
            ${this.events
              .map(
                (ev) =>
                  `<option value="${ev.id}" ${ev.id === this.eventId ? 'selected' : ''}>${escapeHtml(ev.name)}</option>`,
              )
              .join('')}
          </select>
        </div>
        <div class="mx-auto flex max-w-3xl items-center gap-2 px-4 pb-2">
          <input data-keyword-input type="text" placeholder="Add a game or runner keyword"
            class="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder-moss focus:outline-none focus:ring-1 focus:ring-live" />
          <button data-add-keyword
            class="shrink-0 rounded border border-line bg-surface px-3 py-1.5 text-sm text-ink hover:border-live">Add</button>
          <label class="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm text-moss">
            <input data-keywords-only type="checkbox" ${this.keywordsOnly ? 'checked' : ''} class="accent-live" />
            my games
          </label>
        </div>
        <div class="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 pb-3">
          ${this.keywords
            .map(
              (k) => `
            <span class="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-ink">
              ${escapeHtml(k)}
              <button data-remove-keyword="${escapeHtml(k)}" aria-label="Remove ${escapeHtml(k)}"
                class="text-moss hover:text-ink">&times;</button>
            </span>`,
            )
            .join('')}
          <input data-search type="search" value="${escapeHtml(this.query)}" placeholder="Filter view"
            class="min-w-24 flex-1 rounded border border-line bg-surface px-2 py-1 text-xs text-ink placeholder-moss focus:outline-none focus:ring-1 focus:ring-live" />
        </div>
      </header>
      <main data-list class="mx-auto max-w-3xl px-4 pb-16"></main>
    `;
    this.renderList();
  }

  renderList() {
    const list = this.querySelector('[data-list]');
    if (!list) return;

    if (this.status === 'loading') {
      list.innerHTML = `<p class="py-12 text-center text-sm text-moss">Loading schedule...</p>`;
      return;
    }
    if (this.status === 'error') {
      list.innerHTML = `<p class="py-12 text-center text-sm text-moss">Could not load the schedule. ${escapeHtml(this.errorMessage)} Refresh to retry.</p>`;
      return;
    }

    if (this.keywordsOnly && this.keywords.length === 0) {
      list.innerHTML = `
        <div class="py-12 text-center text-sm text-moss">
          <p>No keywords yet. Add a game like zelda or a runner name to build your schedule.</p>
          <button data-show-all class="mt-3 rounded border border-line px-3 py-1 text-ink hover:border-live">Show the full schedule</button>
        </div>`;
      return;
    }

    const visible = filterRuns(this.runs, {
      query: this.query,
      keywordsOnly: this.keywordsOnly,
      keywords: this.keywords,
    });

    if (visible.length === 0) {
      list.innerHTML = `
        <div class="py-12 text-center text-sm text-moss">
          <p>No runs or runners match your keywords at this event.</p>
          <button data-show-all class="mt-3 rounded border border-line px-3 py-1 text-ink hover:border-live">Show the full schedule</button>
        </div>`;
      return;
    }

    const now = new Date();
    const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    const groups = groupRunsByDay(visible);

    list.innerHTML = `
      <p class="py-3 text-xs text-moss">${visible.length} of ${this.runs.length} runs, times shown in your local zone</p>
      ${groups
        .map(
          (group) => `
        <section>
          <h2 class="sticky top-[148px] border-b border-line bg-pitch py-1.5 text-xs font-bold uppercase tracking-widest text-moss">${escapeHtml(group.label)}</h2>
          <ul>
            ${group.runs.map((run) => this.renderRun(run, now, timeFmt)).join('')}
          </ul>
        </section>`,
        )
        .join('')}
    `;
  }

  renderRun(run, now, timeFmt) {
    const live = isLive(run, now);
    const matched = matchesAnyKeyword(run, this.keywords);
    return `
      <li class="flex items-baseline gap-3 border-b border-line/60 py-2.5 ${live ? 'bg-surface' : ''}">
        <span class="w-16 shrink-0 text-right text-xs text-moss">${timeFmt.format(new Date(run.starttime))}</span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm ${matched ? 'text-live' : 'text-ink'}">${escapeHtml(run.name)}
            ${live ? '<span class="ml-1.5 rounded bg-live/15 px-1 text-[10px] font-bold uppercase text-live">Live</span>' : ''}
          </span>
          <span class="block truncate text-xs text-moss">${escapeHtml(run.category || '')}${run.category && runnerNames(run) ? ' / ' : ''}${escapeHtml(runnerNames(run))}</span>
        </span>
        <span class="shrink-0 text-xs text-moss">${formatDuration(run.starttime, run.endtime)}</span>
      </li>`;
  }
}

/**
 * Read the keyword list from localStorage.
 * @returns {string[]} Saved keywords, empty array on first visit.
 */
function loadKeywords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeKeyword).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Persist the keyword list to localStorage.
 * @param {string[]} keywords Keywords to save.
 */
function saveKeywords(keywords) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keywords));
  } catch {
    // Storage may be unavailable in private browsing. Keywords just will not persist.
  }
}

customElements.define('my-gdq-app', MyGdqApp);
