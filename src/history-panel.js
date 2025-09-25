import { log } from './log.js';
import { subscribeHistory, getHistorySnapshot, undo, redo, clearHistory } from './commands/command-bus.js';

export function buildHistoryPanel({ element, title, componentName }) {
  try {
    if (!element) {
      log("ERROR", "[history-panel] missing root element");
      return;
    }

    element.innerHTML = `
      <div id="history-panel-root" style="display:flex;flex-direction:column;height:100%;width:100%;background:#fff;box-sizing:border-box;">
        <div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #e3e8f3;background:#f7f9ff;">
          <div style="font-weight:600;color:#234;flex:1 1 auto;">History</div>
          <div id="hist-counters" style="color:#456;font-size:12px;"></div>
          <button id="hist-undo" class="hist-btn">Undo</button>
          <button id="hist-redo" class="hist-btn">Redo</button>
          <button id="hist-clear" class="hist-btn" title="Clear undo/redo stacks">Clear</button>
        </div>
        <div id="history-list" style="flex:1 1 auto;overflow:auto;padding:8px;display:flex;flex-direction:column;gap:6px;background:#fafcff;"></div>
      </div>
    `;

    const styleId = "history-panel-inline-style";
    if (!document.getElementById(styleId)) {
      const s = document.createElement('style');
      s.id = styleId;
      s.textContent = `
        .hist-btn {
          font: inherit;
          color: #234;
          border: 1px solid #8ca6c6;
          background: #fff;
          border-radius: 7px;
          padding: 4px 8px;
          line-height: 1.2;
          cursor: pointer;
        }
        .hist-btn:disabled {
          opacity: .5;
          cursor: not-allowed;
        }
        .hist-item {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 8px;
          align-items: center;
          background: #ffffff;
          border: 1px solid #e3e8f3;
          border-radius: 8px;
          padding: 6px 8px;
        }
        .hist-type {
          font-weight: 600;
          color: #2176ff;
          white-space: nowrap;
        }
        .hist-time {
          font-size: 11px;
          color: #678;
          white-space: nowrap;
        }
      `;
      document.head.appendChild(s);
    }

    const listEl = element.querySelector('#history-list');
    const undoBtn = element.querySelector('#hist-undo');
    const redoBtn = element.querySelector('#hist-redo');
    const clearBtn = element.querySelector('#hist-clear');
    const countersEl = element.querySelector('#hist-counters');

    let items = [];
    const CAP = 200;

    function setEnabled(el, enabled) {
      if (!el) return;
      el.disabled = !enabled;
      el.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    }

    function pushItem(evt) {
      const timeISO = new Date().toISOString();
      const row = {
        timeISO,
        event: evt?.event || 'dispatch',
        cmdType: evt?.cmdType || null,
        undoDepth: evt?.undoDepth ?? null,
        redoDepth: evt?.redoDepth ?? null
      };
      items.push(row);
      if (items.length > CAP) items.shift();
    }

    function renderCounters(snap) {
      countersEl.textContent = `Undo: ${snap.undoDepth || 0} • Redo: ${snap.redoDepth || 0}`;
      setEnabled(undoBtn, !!snap.canUndo);
      setEnabled(redoBtn, !!snap.canRedo);
    }

    function renderList() {
      if (!listEl) return;
      listEl.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        const div = document.createElement('div');
        div.className = 'hist-item';
        const type = document.createElement('div');
        type.className = 'hist-type';
        type.textContent = it.cmdType || it.event;
        const meta = document.createElement('div');
        meta.style.color = '#345';
        meta.textContent =
          it.event === 'dispatch' ? 'Dispatched' :
          it.event === 'undo' ? 'Undo' :
          it.event === 'redo' ? 'Redo' :
          it.event === 'clear' ? 'Clear' : it.event;
        const time = document.createElement('div');
        time.className = 'hist-time';
        time.textContent = it.timeISO.replace('T', ' ').replace('Z', 'Z');
        div.appendChild(type);
        div.appendChild(meta);
        div.appendChild(time);
        frag.appendChild(div);
      }
      listEl.appendChild(frag);
    }

    function refresh() {
      renderCounters(getHistorySnapshot());
      renderList();
    }

    const unsub = subscribeHistory((evt) => {
      try {
        if (evt?.event === 'subscribe') {
          renderCounters(getHistorySnapshot());
          return;
        }
        pushItem(evt);
        renderCounters(getHistorySnapshot());
        renderList();
      } catch (e) {
        log("WARN", "[history-panel] subscribe render error", e);
      }
    });

    undoBtn?.addEventListener('click', () => {
      try { undo(); } catch (e) { log("ERROR", "[history-panel] undo click error", e); }
    });
    redoBtn?.addEventListener('click', () => {
      try { redo(); } catch (e) { log("ERROR", "[history-panel] redo click error", e); }
    });
    clearBtn?.addEventListener('click', () => {
      try {
        clearHistory();
        items = [];
        refresh();
        log("INFO", "[history-panel] History cleared");
      } catch (e) {
        log("ERROR", "[history-panel] clear click error", e);
      }
    });

    refresh();

    const cleanup = () => {
      try { unsub && unsub(); } catch {}
      try {
        undoBtn && undoBtn.replaceWith(undoBtn.cloneNode(true));
        redoBtn && redoBtn.replaceWith(redoBtn.cloneNode(true));
        clearBtn && clearBtn.replaceWith(clearBtn.cloneNode(true));
      } catch {}
      log("INFO", "[history-panel] cleaned up");
    };

    if (typeof element.on === "function") {
      try { element.on("destroy", cleanup); } catch {}
    }
    window.addEventListener('beforeunload', cleanup, { once: true });

    log("INFO", "[history-panel] ready");
  } catch (e) {
    log("ERROR", "[history-panel] init error", e);
  }
}
