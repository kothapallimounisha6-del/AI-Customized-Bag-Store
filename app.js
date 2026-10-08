const defaults = {
  type: 'tote',
  color: 'moss',
  size: 'medium',
  material: 'canvas',
  pattern: 'solid',
  style: 'easy',
  budget: 150,
};

const options = {
  type: {
    tote: { name: 'Everyday Tote', base: 52, body: 'M155 146 Q155 137 166 137 H354 Q365 137 365 148 L383 354 Q384 366 371 366 H149 Q136 366 137 354 Z', handle: 'M199 150C199 70 218 50 260 50S321 70 321 150', clip: 'M155 146 Q155 137 166 137 H354 Q365 137 365 148 L383 354 Q384 366 371 366 H149 Q136 366 137 354 Z' },
    crossbody: { name: 'Crossbody', base: 68, body: 'M173 174 Q173 164 186 164 H334 Q347 164 350 178 L369 321 Q371 335 357 337 H163 Q149 335 151 321 Z', handle: 'M190 174C172 111 200 78 260 65S350 101 337 174', clip: 'M173 174 Q173 164 186 164 H334 Q347 164 350 178 L369 321 Q371 335 357 337 H163 Q149 335 151 321 Z' },
    shoulder: { name: 'Shoulder Bag', base: 64, body: 'M163 173 Q163 160 178 160 H342 Q357 160 357 173 L372 340 Q373 354 359 356 H161 Q147 354 148 340 Z', handle: 'M205 166C198 95 213 77 260 77S322 96 315 166', clip: 'M163 173 Q163 160 178 160 H342 Q357 160 357 173 L372 340 Q373 354 359 356 H161 Q147 354 148 340 Z' },
  },
  color: {
    moss: { label: 'Moss', value: '#627861' },
    ink: { label: 'Ink', value: '#343b3b' },
    clay: { label: 'Clay', value: '#bd735b' },
    butter: { label: 'Butter', value: '#e7c779' },
    berry: { label: 'Berry', value: '#814c5a' },
    natural: { label: 'Natural', value: '#d7c8a9' },
  },
  size: {
    small: { label: 'Small', add: 0, scale: .88 },
    medium: { label: 'Medium', add: 0, scale: 1 },
    large: { label: 'Large', add: 18, scale: 1.1 },
  },
  material: {
    canvas: { label: 'Organic canvas', add: 0 },
    nylon: { label: 'Recycled nylon', add: 8 },
    vegan: { label: 'Vegan leather', add: 26 },
    leather: { label: 'Full-grain leather', add: 52 },
  },
  pattern: {
    solid: { label: 'Solid', add: 0 },
    botanical: { label: 'Botanical', add: 14 },
    stripe: { label: 'Fine stripe', add: 10 },
    colorblock: { label: 'Color block', add: 12 },
  },
  style: {
    easy: { label: 'Easy & understated' },
    bold: { label: 'Bright & expressive' },
    classic: { label: 'Classic & considered' },
    outdoors: { label: 'Ready for the outdoors' },
  },
};

const state = { ...defaults };
const body = document.querySelector('#bag-body');
const handle = document.querySelector('#bag-handle path');
const clipPath = document.querySelector('#bag-clip-path');
const patternOverlay = document.querySelector('#pattern-overlay');
const colorblockOverlay = document.querySelector('#colorblock-overlay');
const toast = document.querySelector('#toast');
let toastTimer;

function formatPrice(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function getTotal() {
  return options.type[state.type].base
    + options.size[state.size].add
    + options.material[state.material].add
    + options.pattern[state.pattern].add;
}

function setSelection(group, value) {
  document.querySelectorAll(`[data-option="${group}"]`).forEach(button => {
    const selected = button.dataset.value === value;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function updatePreview() {
  const bagType = options.type[state.type];
  const color = options.color[state.color];
  const size = options.size[state.size];
  body.setAttribute('d', bagType.body);
  body.setAttribute('fill', color.value);
  handle.setAttribute('d', bagType.handle);
  clipPath.setAttribute('d', bagType.clip);
  document.querySelector('#bag-svg-title').textContent = `Your ${size.label.toLowerCase()} ${color.label.toLowerCase()} ${bagType.name.toLowerCase()}`;
  document.querySelector('#bag-svg-desc').textContent = `A ${size.label.toLowerCase()} ${color.label.toLowerCase()} ${bagType.name.toLowerCase()} in ${options.material[state.material].label.toLowerCase()} with a ${options.pattern[state.pattern].label.toLowerCase()} finish.`;
  document.querySelector('#color-label').textContent = color.label;
  document.querySelector('#size-tag').textContent = size.label.toUpperCase();
  document.querySelector('#design-name').textContent = `The ${color.label} ${bagType.name}`;
  document.querySelector('#bag-art').style.setProperty('--bag-scale', size.scale);
  document.querySelector('#bag-art').style.transform = `scale(${size.scale})`;
  patternOverlay.setAttribute('fill', state.pattern === 'botanical' ? 'url(#leaf-pattern)' : state.pattern === 'stripe' ? 'url(#stripe-pattern)' : 'transparent');
  colorblockOverlay.setAttribute('opacity', state.pattern === 'colorblock' ? '1' : '0');
  document.querySelector('#design-tags').innerHTML = '';
  [options.material[state.material].label, options.pattern[state.pattern].label, options.style[state.style].label].forEach(label => {
    const tag = document.createElement('span');
    tag.textContent = label;
    document.querySelector('#design-tags').append(tag);
  });
}

function updateEstimate() {
  const total = getTotal();
  const priceLines = [
    [`${options.type[state.type].name} · base`, options.type[state.type].base],
    [`${options.size[state.size].label} size`, options.size[state.size].add],
    [options.material[state.material].label, options.material[state.material].add],
    [`${options.pattern[state.pattern].label} finish`, options.pattern[state.pattern].add],
  ];
  document.querySelector('#price-lines').replaceChildren(...priceLines.map(([label, price]) => {
    const row = document.createElement('div');
    row.className = 'price-line';
    const name = document.createElement('span');
    name.textContent = label;
    const amount = document.createElement('b');
    amount.textContent = price === 0 && label !== `${options.type[state.type].name} · base` ? 'Included' : formatPrice(price);
    row.append(name, amount);
    return row;
  }));
  document.querySelector('#total-price').textContent = formatPrice(total);

  const remaining = state.budget - total;
  const budgetStatus = document.querySelector('#budget-status');
  budgetStatus.classList.toggle('over', remaining < 0);
  budgetStatus.classList.toggle('within', remaining >= 0);
  document.querySelector('.budget-icon').textContent = remaining >= 0 ? '✓' : '!';
  document.querySelector('#budget-message').textContent = remaining >= 0 ? `Within your ${formatPrice(state.budget)} budget` : `${formatPrice(Math.abs(remaining))} over your budget`;
  document.querySelector('#budget-remaining').textContent = remaining >= 0 ? `${formatPrice(remaining)} left` : `Budget ${formatPrice(state.budget)}`;
  document.querySelector('#budget-amount').textContent = formatPrice(state.budget);
}

function render() {
  updatePreview();
  updateEstimate();
}

function announce(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

document.querySelectorAll('[data-option]').forEach(button => button.addEventListener('click', () => {
  const { option, value } = button.dataset;
  state[option] = value;
  setSelection(option, value);
  render();
}));

document.querySelector('#style-select').addEventListener('change', event => {
  state.style = event.target.value;
  render();
});

document.querySelector('#budget-slider').addEventListener('input', event => {
  state.budget = Number(event.target.value);
  updateEstimate();
});

function savedDesigns() {
  try {
    return JSON.parse(localStorage.getItem('atelier-form-designs') || '[]');
  } catch {
    return [];
  }
}

function updateSavedCount() {
  const count = savedDesigns().length;
  document.querySelector('#saved-count span').textContent = `${count} saved`;
}

window.getBagDesignContext = () => ({
  bagType: options.type[state.type].name,
  color: options.color[state.color].label,
  size: options.size[state.size].label,
  material: options.material[state.material].label,
  pattern: options.pattern[state.pattern].label,
  style: options.style[state.style].label,
  estimatedPrice: formatPrice(getTotal()),
  budget: formatPrice(state.budget),
  withinBudget: getTotal() <= state.budget,
});

document.querySelector('#save-design').addEventListener('click', () => {
  const designs = savedDesigns();
  designs.push({ ...state, name: document.querySelector('#design-name').textContent, price: getTotal(), savedAt: new Date().toISOString() });
  try {
    localStorage.setItem('atelier-form-designs', JSON.stringify(designs));
    updateSavedCount();
    announce(`${document.querySelector('#design-name').textContent} saved at ${formatPrice(getTotal())}.`);
  } catch {
    announce('This design could not be saved in this browser.');
  }
});

document.querySelector('#reset-design').addEventListener('click', () => {
  Object.assign(state, defaults);
  document.querySelector('#style-select').value = defaults.style;
  document.querySelector('#budget-slider').value = defaults.budget;
  Object.entries(defaults).forEach(([option, value]) => {
    if (option !== 'style' && option !== 'budget') setSelection(option, value);
  });
  render();
  announce('Back to your starting design.');
});

document.querySelector('#saved-count').addEventListener('click', () => {
  const count = savedDesigns().length;
  announce(count ? `You have ${count} saved ${count === 1 ? 'design' : 'designs'} on this device.` : 'Your saved designs will appear here.');
});

const svgNamespace = 'http://www.w3.org/2000/svg';
const textureDefinitions = {
  canvas: { size: 8, lines: [['M0 2H8M0 6H8', '#fff8e7', '.14'], ['M2 0V8M6 0V8', '#263b2b', '.08']] },
  nylon: { size: 9, lines: [['M-2 9L9-2M3 11L11 3', '#fff8e7', '.2']] },
  vegan: { size: 12, lines: [['M0 3H12M0 9H12', '#fff8e7', '.13']] },
  leather: { size: 18, lines: [['M2 6Q8 2 14 6M4 14Q9 11 15 14', '#fff8e7', '.12']] },
};

Object.entries(textureDefinitions).forEach(([material, texture]) => {
  const pattern = document.createElementNS(svgNamespace, 'pattern');
  pattern.setAttribute('id', `material-${material}`);
  pattern.setAttribute('width', texture.size);
  pattern.setAttribute('height', texture.size);
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  texture.lines.forEach(([pathData, color, opacity]) => {
    const path = document.createElementNS(svgNamespace, 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-opacity', opacity);
    path.setAttribute('fill', 'none');
    pattern.append(path);
  });
  document.querySelector('#bag-art defs').append(pattern);
});

const materialOverlay = document.createElementNS(svgNamespace, 'rect');
materialOverlay.id = 'material-overlay';
Object.entries({ x: 120, y: 120, width: 280, height: 270 }).forEach(([attribute, value]) => materialOverlay.setAttribute(attribute, value));
document.querySelector('#pattern-overlay').before(materialOverlay);
const baseUpdatePreview = updatePreview;
updatePreview = function () {
  baseUpdatePreview();
  materialOverlay.setAttribute('fill', `url(#material-${state.material})`);
};

const matchButton = document.createElement('button');
matchButton.className = 'match-button';
matchButton.type = 'button';
matchButton.setAttribute('aria-label', 'Find a bag design that matches your style and budget');
const matchLabel = document.createElement('span');
matchLabel.textContent = 'Find my style + budget match';
const matchArrow = document.createElement('span');
matchArrow.textContent = '→';
matchArrow.setAttribute('aria-hidden', 'true');
matchButton.append(matchLabel, matchArrow);
document.querySelector('.range-labels').after(matchButton);

const styleMatches = {
  easy: { type: ['tote', 'shoulder', 'crossbody'], color: ['moss', 'natural', 'ink', 'clay', 'butter', 'berry'], size: ['medium', 'small', 'large'], material: ['canvas', 'nylon', 'vegan', 'leather'], pattern: ['solid', 'botanical', 'stripe', 'colorblock'] },
  bold: { type: ['crossbody', 'tote', 'shoulder'], color: ['clay', 'butter', 'berry', 'moss', 'ink', 'natural'], size: ['small', 'medium', 'large'], material: ['canvas', 'nylon', 'vegan', 'leather'], pattern: ['colorblock', 'botanical', 'stripe', 'solid'] },
  classic: { type: ['shoulder', 'tote', 'crossbody'], color: ['ink', 'natural', 'berry', 'moss', 'clay', 'butter'], size: ['medium', 'small', 'large'], material: ['vegan', 'leather', 'canvas', 'nylon'], pattern: ['solid', 'stripe', 'botanical', 'colorblock'] },
  outdoors: { type: ['crossbody', 'tote', 'shoulder'], color: ['moss', 'ink', 'natural', 'clay', 'berry', 'butter'], size: ['medium', 'small', 'large'], material: ['nylon', 'canvas', 'vegan', 'leather'], pattern: ['stripe', 'solid', 'colorblock', 'botanical'] },
};

matchButton.addEventListener('click', () => {
  const preferences = styleMatches[state.style];
  let bestMatch;
  for (const type of preferences.type) {
    for (const color of preferences.color) {
      for (const size of preferences.size) {
        for (const material of preferences.material) {
          for (const pattern of preferences.pattern) {
            const candidate = { type, color, size, material, pattern };
            const total = options.type[type].base + options.size[size].add + options.material[material].add + options.pattern[pattern].add;
            const withinBudget = total <= state.budget;
            const score = preferences.type.indexOf(type) * 4
              + preferences.color.indexOf(color) * 2
              + preferences.size.indexOf(size)
              + preferences.material.indexOf(material) * 4
              + preferences.pattern.indexOf(pattern) * 3;
            const rank = withinBudget ? [0, score, total] : [1, total, score];
            const isBetter = !bestMatch || rank.some((value, index) => value !== bestMatch.rank[index]
              && rank.slice(0, index).every((prior, priorIndex) => prior === bestMatch.rank[priorIndex])
              && value < bestMatch.rank[index]);
            if (isBetter) bestMatch = { candidate, rank };
          }
        }
      }
    }
  }

  Object.assign(state, bestMatch.candidate);
  Object.entries(bestMatch.candidate).forEach(([option, value]) => setSelection(option, value));
  render();
  const total = getTotal();
  announce(total <= state.budget
    ? `Matched your ${options.style[state.style].label.toLowerCase()} style at ${formatPrice(total)}.`
    : `The lowest available design is ${formatPrice(total)}, above your ${formatPrice(state.budget)} budget.`);
});

updateSavedCount();
render();