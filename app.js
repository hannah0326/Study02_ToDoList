// 작성: 2026-10-01 11:28 KST

(function () {
  'use strict';

  var STORAGE_KEY = 'todos';
  var CATEGORIES = { work: '업무', personal: '개인', study: '공부' };

  // 상태
  var todos = load();
  var filter = 'all';
  var editingId = null;

  // DOM
  var form = document.getElementById('add-form');
  var newText = document.getElementById('new-text');
  var newCategory = document.getElementById('new-category');
  var filtersEl = document.getElementById('filters');
  var listEl = document.getElementById('todo-list');
  var emptyEl = document.getElementById('empty');

  // ---------- 저장 ----------

  // 저장된 데이터를 읽는다. 없거나 손상되었으면 빈 배열로 시작한다.
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(function (t) {
        return t && typeof t.id === 'string' && typeof t.text === 'string' &&
          CATEGORIES[t.category] && typeof t.done === 'boolean';
      });
    } catch (e) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (e) {
      // 저장소 접근이 막힌 환경에서도 앱은 계속 동작한다.
    }
  }

  // ---------- 진행률 ----------

  // 완료 개수, 전체 개수, 퍼센트를 계산한다. 항목이 없으면 0%.
  function summarize(list) {
    var total = list.length;
    var done = list.filter(function (t) { return t.done; }).length;
    return { done: done, total: total, percent: total === 0 ? 0 : Math.round(done / total * 100) };
  }

  // 전체와 카테고리별 진행률을 한 번에 계산한다. (입력 배열만 사용하는 순수 함수)
  function calcProgress(list) {
    var result = { total: summarize(list) };
    Object.keys(CATEGORIES).forEach(function (key) {
      result[key] = summarize(list.filter(function (t) { return t.category === key; }));
    });
    return result;
  }

  function renderProgress() {
    var progress = calcProgress(todos);
    Object.keys(progress).forEach(function (key) {
      var p = progress[key];
      var item = document.querySelector('.progress-item[data-key="' + key + '"]');
      item.querySelector('.progress-text').textContent = p.done + ' / ' + p.total + ' (' + p.percent + '%)';
      item.querySelector('.bar').setAttribute('aria-valuenow', String(p.percent));
      item.querySelector('.bar-fill').style.width = p.percent + '%';
    });
  }

  // ---------- 렌더링 ----------

  function makeButton(label, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function makeBadge(category) {
    var badge = document.createElement('span');
    badge.className = 'badge ' + category;
    badge.textContent = CATEGORIES[category];
    return badge;
  }

  function renderItem(todo) {
    var li = document.createElement('li');
    li.className = 'todo' + (todo.done ? ' done' : '');

    if (todo.id === editingId) {
      return renderEditing(li, todo);
    }

    var check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = todo.done;
    check.setAttribute('aria-label', '완료 체크: ' + todo.text);
    check.addEventListener('change', function () { toggle(todo.id); });

    var text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;
    text.addEventListener('dblclick', function () { startEdit(todo.id); });

    var actions = document.createElement('div');
    actions.className = 'todo-actions';
    actions.appendChild(makeButton('수정', function () { startEdit(todo.id); }));
    actions.appendChild(makeButton('삭제', function () { remove(todo.id); }));

    li.appendChild(check);
    li.appendChild(text);
    li.appendChild(makeBadge(todo.category));
    li.appendChild(actions);
    return li;
  }

  // 인라인 편집 상태의 항목을 만든다.
  function renderEditing(li, todo) {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-input';
    input.value = todo.text;
    input.setAttribute('aria-label', '할 일 수정');

    var select = document.createElement('select');
    select.setAttribute('aria-label', '카테고리 수정');
    Object.keys(CATEGORIES).forEach(function (key) {
      var opt = document.createElement('option');
      opt.value = key;
      opt.textContent = CATEGORIES[key];
      if (key === todo.category) opt.selected = true;
      select.appendChild(opt);
    });

    function commit() { saveEdit(todo.id, input.value, select.value); }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { cancelEdit(); }
    });
    select.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { cancelEdit(); }
    });

    var actions = document.createElement('div');
    actions.className = 'todo-actions';
    actions.appendChild(makeButton('저장', commit));
    actions.appendChild(makeButton('취소', cancelEdit));

    li.appendChild(input);
    li.appendChild(select);
    li.appendChild(actions);

    // 렌더 직후 포커스를 주기 위해 표시해 둔다.
    li.dataset.editing = '1';
    return li;
  }

  function render() {
    var visible = todos.filter(function (t) { return filter === 'all' || t.category === filter; });

    listEl.textContent = '';
    visible.forEach(function (t) { listEl.appendChild(renderItem(t)); });
    emptyEl.hidden = visible.length > 0;

    Array.prototype.forEach.call(filtersEl.querySelectorAll('button'), function (b) {
      b.classList.toggle('active', b.dataset.filter === filter);
    });

    renderProgress();

    var editingLi = listEl.querySelector('li[data-editing="1"]');
    if (editingLi) {
      var input = editingLi.querySelector('.edit-input');
      input.focus();
      input.select();
    }
  }

  // ---------- 동작 ----------

  function changed() {
    save();
    render();
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function add(text, category) {
    var trimmed = text.trim();
    if (!trimmed) return false;
    todos.push({ id: newId(), text: trimmed, category: category, done: false, createdAt: Date.now() });
    changed();
    return true;
  }

  function findTodo(id) {
    return todos.filter(function (t) { return t.id === id; })[0];
  }

  function toggle(id) {
    var t = findTodo(id);
    if (!t) return;
    t.done = !t.done;
    changed();
  }

  function remove(id) {
    var t = findTodo(id);
    if (!t) return;
    if (!window.confirm('"' + t.text + '" 항목을 삭제할까요?')) return;
    todos = todos.filter(function (x) { return x.id !== id; });
    if (editingId === id) editingId = null;
    changed();
  }

  function startEdit(id) {
    editingId = id;
    render();
  }

  function cancelEdit() {
    editingId = null;
    render();
  }

  function saveEdit(id, text, category) {
    var trimmed = text.trim();
    if (!trimmed) return; // 빈 내용으로는 저장하지 않는다.
    var t = findTodo(id);
    if (!t) return;
    t.text = trimmed;
    t.category = category;
    editingId = null;
    changed();
  }

  // ---------- 이벤트 ----------

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (add(newText.value, newCategory.value)) {
      newText.value = '';
    }
    newText.focus();
  });

  filtersEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    filter = btn.dataset.filter;
    editingId = null;
    render();
  });

  render();
})();
