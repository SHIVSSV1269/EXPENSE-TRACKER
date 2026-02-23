/* ======================================================
   SpendAI — AI/ML Expense Tracker Engine
   ====================================================== */

'use strict';

// ──────────────────────────────────────────────
// 1. DATA STORE
// ──────────────────────────────────────────────
const DB = {
  expenses: [],
  settings: { totalBudget: 2000, categoryBudgets: {} },

  load() {
    try {
      const e = localStorage.getItem('spendai_expenses');
      const s = localStorage.getItem('spendai_settings');
      if (e) this.expenses = JSON.parse(e);
      if (s) this.settings = { ...this.settings, ...JSON.parse(s) };
    } catch (_) {}
  },

  save() {
    localStorage.setItem('spendai_expenses', JSON.stringify(this.expenses));
    localStorage.setItem('spendai_settings', JSON.stringify(this.settings));
  },

  addExpense(exp) {
    exp.id = Date.now() + Math.random();
    this.expenses.unshift(exp);
    this.save();
    return exp;
  },

  deleteExpense(id) {
    this.expenses = this.expenses.filter(e => e.id !== id);
    this.save();
  }
};

// ──────────────────────────────────────────────
// 2. AI/ML ENGINE
// ──────────────────────────────────────────────
const AI = {

  // Category definitions with keywords + emoji
  CATEGORIES: {
    food:          { label: 'Food & Dining',      emoji: '🍔', color: '#f59e0b', keywords: ['food','eat','lunch','dinner','breakfast','restaurant','cafe','coffee','pizza','burger','sushi','grocery','groceries','supermarket','walmart','kroger','target','snack','drink','bar','pub','drink','chipotle','mcdonald','starbucks','doordash','ubereats','grubhub','takeout','takeaway','cook','meal','diet','bread','milk','fruit','vegetable','wine','beer'] },
    transport:     { label: 'Transport',           emoji: '🚗', color: '#3b82f6', keywords: ['uber','lyft','taxi','bus','train','metro','subway','fare','fuel','gas','petrol','parking','toll','vehicle','car','ride','transport','commute','flight','ticket','amtrak','greyhound','bike','scooter','tram','ferry','oil','maintenance','repair'] },
    shopping:      { label: 'Shopping',            emoji: '🛍️', color: '#ec4899', keywords: ['amazon','shop','store','mall','clothes','clothing','fashion','shoes','dress','shirt','pants','jacket','bag','accessories','electronics','gadget','appliance','furniture','home','decor','ebay','etsy','purchase','order','buy','product','item'] },
    health:        { label: 'Health',              emoji: '💊', color: '#10b981', keywords: ['doctor','hospital','clinic','medicine','pharmacy','drug','prescription','dental','dentist','eye','vision','health','medical','therapy','therapist','insurance','lab','test','emergency','vet','pet','vaccine','vitamin','supplement'] },
    entertainment: { label: 'Entertainment',       emoji: '🎬', color: '#8b5cf6', keywords: ['netflix','spotify','movie','cinema','theatre','game','gaming','steam','playstation','xbox','concert','event','ticket','show','museum','park','amusement','sport','streaming','hulu','disney','prime','hbo','apple tv','youtube','twitch','music','book','magazine'] },
    bills:         { label: 'Bills & Utilities',   emoji: '📄', color: '#64748b', keywords: ['electric','electricity','water','gas','internet','wifi','phone','mobile','cable','tv','rent','mortgage','insurance','loan','credit','subscription','monthly','bill','utility','service','payment','due','fee'] },
    education:     { label: 'Education',           emoji: '📚', color: '#06b6d4', keywords: ['school','college','university','tuition','course','class','lesson','book','textbook','study','learn','training','workshop','seminar','udemy','coursera','tutorial','degree','exam','test','certificate','skill'] },
    travel:        { label: 'Travel',              emoji: '✈️', color: '#f97316', keywords: ['hotel','airbnb','flight','airline','airport','vacation','holiday','trip','tour','travel','cruise','resort','booking','expedia','kayak','passport','visa','luggage','baggage','sightseeing','tour'] },
    fitness:       { label: 'Fitness',             emoji: '💪', color: '#84cc16', keywords: ['gym','fitness','workout','exercise','sport','yoga','pilates','run','marathon','swim','cycling','bike','trainer','supplement','protein','membership','class','crossfit','zumba'] },
    personal:      { label: 'Personal Care',       emoji: '👤', color: '#a78bfa', keywords: ['salon','barber','haircut','hair','beauty','spa','massage','cosmetics','makeup','skincare','lotion','perfume','grooming','nail','facial','wax','shave','toiletry','soap','shampoo'] },
    investments:   { label: 'Investments',         emoji: '📈', color: '#22d3ee', keywords: ['invest','stock','crypto','bitcoin','etf','fund','bond','savings','portfolio','brokerage','robinhood','coinbase','401k','ira','dividend','trading','forex','gold','silver'] },
    other:         { label: 'Other',               emoji: '📦', color: '#94a3b8', keywords: [] }
  },

  // Auto-categorize using keyword NLP scoring
  categorize(description) {
    const text = description.toLowerCase();
    let best = { cat: 'other', score: 0 };

    for (const [cat, info] of Object.entries(this.CATEGORIES)) {
      if (cat === 'other') continue;
      let score = 0;
      for (const kw of info.keywords) {
        if (text.includes(kw)) {
          score += kw.length > 5 ? 3 : 2; // longer keyword = higher confidence
        }
      }
      if (score > best.score) best = { cat, score };
    }

    const confidence = best.score >= 6 ? 'High' : best.score >= 2 ? 'Medium' : 'Low';
    return { category: best.cat, confidence, score: best.score };
  },

  // Z-score anomaly detection per category
  detectAnomalies(expenses) {
    const anomalies = [];
    const catGroups = {};

    for (const exp of expenses) {
      if (!catGroups[exp.category]) catGroups[exp.category] = [];
      catGroups[exp.category].push(exp.amount);
    }

    for (const [cat, amounts] of Object.entries(catGroups)) {
      if (amounts.length < 3) continue;
      const mean = amounts.reduce((a,b)=>a+b,0) / amounts.length;
      const std = Math.sqrt(amounts.reduce((a,b)=>a+Math.pow(b-mean,2),0) / amounts.length);
      if (std === 0) continue;

      for (const exp of expenses) {
        if (exp.category !== cat) continue;
        const z = Math.abs((exp.amount - mean) / std);
        if (z > 1.8) {
          anomalies.push({ ...exp, zScore: z.toFixed(1), mean: mean.toFixed(2) });
        }
      }
    }
    return anomalies.slice(0, 5);
  },

  // Linear regression budget forecast
  forecastNextMonth(expenses) {
    const monthlyTotals = {};

    for (const exp of expenses) {
      const d = new Date(exp.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      monthlyTotals[key] = (monthlyTotals[key] || 0) + exp.amount;
    }

    const entries = Object.entries(monthlyTotals).sort(([a],[b]) => a.localeCompare(b));
    if (entries.length < 2) {
      const total = expenses.reduce((s,e) => s+e.amount, 0);
      return { predicted: total || 0, confidence: 'Low', months: entries.length };
    }

    // Simple linear regression
    const n = entries.length;
    const xs = entries.map((_,i) => i+1);
    const ys = entries.map(([,v]) => v);
    const sumX = xs.reduce((a,b)=>a+b,0);
    const sumY = ys.reduce((a,b)=>a+b,0);
    const sumXY = xs.reduce((s,x,i)=>s+x*ys[i],0);
    const sumX2 = xs.reduce((s,x)=>s+x*x,0);
    const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
    const intercept = (sumY - slope*sumX) / n;
    const predicted = Math.max(0, slope*(n+1) + intercept);

    const confidence = entries.length >= 4 ? 'High' : entries.length >= 2 ? 'Medium' : 'Low';
    return { predicted: Math.round(predicted * 100) / 100, confidence, months: entries.length, slope };
  },

  // Calculate financial health score (0-100)
  calcScore(expenses, totalBudget) {
    if (!expenses.length) return null;
    const now = new Date();
    const thisMonth = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const total = thisMonth.reduce((s,e) => s+e.amount, 0);
    const budgetScore = totalBudget > 0 ? Math.max(0, 1 - total/totalBudget) : 0.5;

    // Category diversity (more diverse = healthier)
    const cats = new Set(thisMonth.map(e=>e.category)).size;
    const diversityScore = Math.min(cats / 6, 1);

    // Consistency score (having regular expenses)
    const days = new Set(thisMonth.map(e=>e.date.slice(0,10))).size;
    const consistencyScore = Math.min(days / 20, 1);

    const score = Math.round((budgetScore * 0.5 + diversityScore * 0.25 + consistencyScore * 0.25) * 100);
    return Math.min(99, Math.max(5, score));
  },

  // Generate smart tips based on patterns
  generateTips(expenses, totalBudget) {
    const tips = [];
    if (!expenses.length) return tips;

    const now = new Date();
    const thisMonthExp = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const total = thisMonthExp.reduce((s,e) => s+e.amount, 0);

    // Category breakdown
    const catTotals = {};
    for (const e of thisMonthExp) catTotals[e.category] = (catTotals[e.category]||0) + e.amount;

    const sorted = Object.entries(catTotals).sort(([,a],[,b])=>b-a);
    if (sorted.length > 0) {
      const [topCat, topAmt] = sorted[0];
      const pct = ((topAmt/total)*100).toFixed(0);
      const info = this.CATEGORIES[topCat];
      if (pct > 40) {
        tips.push({ icon:'⚠️', text: `${info?.emoji} ${info?.label} is your biggest expense at ${pct}% ($${topAmt.toFixed(2)}). Consider setting a limit to diversify your budget.` });
      } else {
        tips.push({ icon:'📊', text: `Your top category is ${info?.emoji} ${info?.label} at $${topAmt.toFixed(2)} (${pct}% of spending). Looking balanced!` });
      }
    }

    // Budget tips
    if (totalBudget > 0) {
      const remaining = totalBudget - total;
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
      const dailyBudget = remaining / (daysInMonth - dayOfMonth + 1);
      if (remaining < 0) {
        tips.push({ icon:'🚨', text: `You're $${Math.abs(remaining).toFixed(2)} over budget this month. Try to cut back on non-essential spending.` });
      } else if (remaining < totalBudget * 0.15) {
        tips.push({ icon:'⚡', text: `Only $${remaining.toFixed(2)} left in your budget. You have ~$${dailyBudget.toFixed(0)}/day for the rest of the month.` });
      } else {
        tips.push({ icon:'✅', text: `Great! You have $${remaining.toFixed(2)} remaining (${((remaining/totalBudget)*100).toFixed(0)}%). Keep it up!` });
      }
    }

    // Food tip
    const foodAmt = catTotals['food'] || 0;
    if (foodAmt > 200) {
      tips.push({ icon:'🍔', text: `You spent $${foodAmt.toFixed(2)} on food this month. Try meal-prepping to cut costs by 20-30%.` });
    }

    // Subscription tip
    const billsAmt = catTotals['bills'] || 0;
    const entAmt = catTotals['entertainment'] || 0;
    if (billsAmt + entAmt > 100) {
      tips.push({ icon:'📱', text: `Your bills & subscriptions total $${(billsAmt+entAmt).toFixed(2)}. Consider auditing and canceling unused subscriptions.` });
    }

    // Savings tip
    if (sorted.length > 0 && !catTotals['investments']) {
      tips.push({ icon:'💰', text: `You haven't tracked any investments this month. Consider setting aside even 5-10% of your income for long-term wealth building.` });
    }

    return tips.slice(0, 5);
  },

  // Day-of-week spending pattern
  dayOfWeekPattern(expenses) {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const totals = new Array(7).fill(0);
    const counts = new Array(7).fill(0);

    for (const e of expenses) {
      const d = new Date(e.date);
      totals[d.getDay()] += e.amount;
      counts[d.getDay()]++;
    }

    return days.map((day, i) => ({ day, total: totals[i], count: counts[i] }));
  }
};

// ──────────────────────────────────────────────
// 3. CHARTS
// ──────────────────────────────────────────────
let charts = {};

const CHART_DEFAULTS = {
  color: 'rgba(255,255,255,0.7)',
  gridColor: 'rgba(255,255,255,0.05)',
  font: { family: 'Inter', size: 11 }
};

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

function buildTrendChart(expenses) {
  destroyChart('trend');
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;

  // Last 6 months
  const months = [];
  const totals = [];
  const now = new Date();
  for (let i = 5; i >=0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    months.push(label);
    const sum = expenses
      .filter(e => { const ed = new Date(e.date); return ed.getMonth()===d.getMonth() && ed.getFullYear()===d.getFullYear(); })
      .reduce((s,e) => s+e.amount, 0);
    totals.push(parseFloat(sum.toFixed(2)));
  }

  // EMA smoothing
  const ema = totals.map((v,i,arr) => {
    if (i===0) return v;
    return arr.slice(0,i+1).reduce((s,x)=>s+x,0)/(i+1);
  });

  charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Actual', data: totals,
        borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.08)',
        borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: '#6366f1',
        fill: true, tension: 0.4
      }, {
        label: 'Trend', data: ema,
        borderColor: '#a78bfa', borderDash: [5,5],
        borderWidth: 1.5, pointRadius: 0,
        fill: false, tension: 0.4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: CHART_DEFAULTS.color, font: CHART_DEFAULTS.font, boxWidth: 12 } } },
      scales: {
        x: { ticks: { color: CHART_DEFAULTS.color, font: CHART_DEFAULTS.font }, grid: { color: CHART_DEFAULTS.gridColor } },
        y: { ticks: { color: CHART_DEFAULTS.color, font: CHART_DEFAULTS.font, callback: v=>'$'+v }, grid: { color: CHART_DEFAULTS.gridColor } }
      }
    }
  });
}

function buildCategoryChart(expenses) {
  destroyChart('category');
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;

  const now = new Date();
  const thisMonth = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
  });

  const catTotals = {};
  for (const e of thisMonth) catTotals[e.category] = (catTotals[e.category]||0)+e.amount;

  const entries = Object.entries(catTotals).sort(([,a],[,b])=>b-a).slice(0,8);
  if (!entries.length) {
    const nodata = document.getElementById('categoryChart');
    if (nodata) nodata.parentElement.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:60px 0">No data this month</p>';
    return;
  }

  charts.category = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(([k]) => AI.CATEGORIES[k]?.emoji+' '+AI.CATEGORIES[k]?.label||k),
      datasets: [{ data: entries.map(([,v])=>v), backgroundColor: entries.map(([k])=>AI.CATEGORIES[k]?.color||'#94a3b8'), borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { color: CHART_DEFAULTS.color, font: { ...CHART_DEFAULTS.font, size: 10 }, boxWidth: 10, padding: 10 } } }
    }
  });
}

function buildWeeklyChart(expenses) {
  destroyChart('weekly');
  const ctx = document.getElementById('weeklyChart');
  if (!ctx) return;

  const now = new Date();
  const days = [];
  const amounts = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate()-i);
    const key = d.toISOString().slice(0,10);
    days.push(d.getDate()+'/'+(d.getMonth()+1));
    const sum = expenses.filter(e => e.date.slice(0,10)===key).reduce((s,e)=>s+e.amount,0);
    amounts.push(parseFloat(sum.toFixed(2)));
  }

  charts.weekly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Daily Spend', data: amounts,
        backgroundColor: amounts.map(v => v > 0 ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.04)'),
        borderRadius: 4, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: CHART_DEFAULTS.color, font: { ...CHART_DEFAULTS.font, size: 9 }, maxRotation: 45 }, grid: { display: false } },
        y: { ticks: { color: CHART_DEFAULTS.color, font: CHART_DEFAULTS.font, callback: v=>'$'+v }, grid: { color: CHART_DEFAULTS.gridColor } }
      }
    }
  });
}

// ──────────────────────────────────────────────
// 4. UI HELPERS
// ──────────────────────────────────────────────
const fmt = n => '$' + parseFloat(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.className = 'toast', 2600);
}

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-'+page);
  const navEl  = document.getElementById('nav-'+page);
  if (pageEl) pageEl.classList.add('active');
  if (navEl)  navEl.classList.add('active');

  // Rebuild charts on navigation
  if (page === 'dashboard') { buildTrendChart(DB.expenses); buildCategoryChart(DB.expenses); }
  if (page === 'expenses')  buildWeeklyChart(DB.expenses);
  if (page === 'insights')  renderInsights();
  if (page === 'budget')    renderBudget();
}

// ──────────────────────────────────────────────
// 5. RENDER FUNCTIONS
// ──────────────────────────────────────────────
function renderDashboard() {
  const now = new Date();
  const thisMonthExp = DB.expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
  });
  const lastMonthExp = DB.expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth()===(now.getMonth()-1+12)%12;
  });

  const totalMonth = thisMonthExp.reduce((s,e)=>s+e.amount,0);
  const lastTotal  = lastMonthExp.reduce((s,e)=>s+e.amount,0);
  const budget     = DB.settings.totalBudget || 2000;
  const remaining  = budget - totalMonth;

  document.getElementById('total-month').textContent  = fmt(totalMonth);
  document.getElementById('budget-remaining').textContent = fmt(Math.max(0, remaining));
  document.getElementById('budget-pct').textContent = `${((totalMonth/budget)*100).toFixed(0)}% of $${budget} budget`;

  // Month change
  const changeEl = document.getElementById('month-change');
  if (lastTotal > 0) {
    const diff = ((totalMonth - lastTotal)/lastTotal*100).toFixed(0);
    const sign = diff > 0 ? '+' : '';
    changeEl.textContent = `${sign}${diff}% vs last month`;
    changeEl.style.color = diff > 0 ? 'var(--red)' : 'var(--green)';
  } else {
    changeEl.textContent = 'First month tracked';
  }

  // Avg daily
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const avgDaily = totalMonth / now.getDate();
  document.getElementById('avg-daily').textContent = fmt(avgDaily);

  // Top category
  const catTotals = {};
  for (const e of thisMonthExp) catTotals[e.category] = (catTotals[e.category]||0)+e.amount;
  const topCat = Object.entries(catTotals).sort(([,a],[,b])=>b-a)[0];
  document.getElementById('top-category').textContent = topCat
    ? `Top: ${AI.CATEGORIES[topCat[0]]?.emoji} ${AI.CATEGORIES[topCat[0]]?.label}`
    : 'No data yet';

  // AI forecast
  const forecast = AI.forecastNextMonth(DB.expenses);
  document.getElementById('ai-forecast').textContent = forecast.months >= 1 ? fmt(forecast.predicted) : '$—';

  // Recent list
  const recentList = document.getElementById('recent-list');
  const recent = DB.expenses.slice(0, 6);
  if (recent.length === 0) {
    recentList.innerHTML = '<div class="empty-state">No expenses yet. Add your first one!</div>';
  } else {
    recentList.innerHTML = recent.map(e => renderExpenseItem(e)).join('');
  }

  // Anomalies
  const anomalies = AI.detectAnomalies(DB.expenses);
  const anomList = document.getElementById('anomaly-list');
  if (anomalies.length === 0) {
    anomList.innerHTML = '<div class="empty-state">No anomalies detected. Great job! 🎉</div>';
  } else {
    anomList.innerHTML = anomalies.map(a =>
      `<div class="anomaly-item">
        <div class="anomaly-head">
          <span class="anomaly-icon">⚠️</span>
          <span class="anomaly-name">${escHtml(a.description)}</span>
        </div>
        <div class="anomaly-desc">${fmt(a.amount)} is ${a.zScore}σ above your avg ${AI.CATEGORIES[a.category]?.label} spend of ${fmt(a.mean)}</div>
      </div>`
    ).join('');
  }

  buildTrendChart(DB.expenses);
  buildCategoryChart(DB.expenses);
}

function renderExpenseItem(e) {
  const cat = AI.CATEGORIES[e.category] || AI.CATEGORIES.other;
  return `<div class="expense-item">
    <div class="exp-icon">${cat.emoji}</div>
    <div class="exp-info">
      <div class="exp-name">${escHtml(e.description)}</div>
      <div class="exp-cat">${cat.label}</div>
    </div>
    <div>
      <div class="exp-amount">${fmt(e.amount)}</div>
      <div class="exp-date">${formatDate(e.date)}</div>
    </div>
  </div>`;
}

function renderExpensesPage() {
  const search = (document.getElementById('search-input')?.value||'').toLowerCase();
  const catFilter = document.getElementById('filter-category')?.value||'';
  const periodFilter = document.getElementById('filter-period')?.value||'all';

  const now = new Date();

  const filtered = DB.expenses.filter(e => {
    const d = new Date(e.date);
    if (search && !e.description.toLowerCase().includes(search)) return false;
    if (catFilter && e.category !== catFilter) return false;
    if (periodFilter === 'this-month' && (d.getMonth()!==now.getMonth()||d.getFullYear()!==now.getFullYear())) return false;
    if (periodFilter === 'last-month') {
      const lm = new Date(now.getFullYear(), now.getMonth()-1, 1);
      if (d.getMonth()!==lm.getMonth()||d.getFullYear()!==lm.getFullYear()) return false;
    }
    if (periodFilter === 'last-3') {
      const cutoff = new Date(now.getFullYear(), now.getMonth()-3, 1);
      if (d < cutoff) return false;
    }
    return true;
  });

  const tbody = document.getElementById('expense-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-td">No expenses found.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(e => {
    const cat = AI.CATEGORIES[e.category]||AI.CATEGORIES.other;
    return `<tr>
      <td><strong>${escHtml(e.description)}</strong>${e.notes ? '<br><small style="color:var(--text-muted)">'+escHtml(e.notes)+'</small>' : ''}</td>
      <td><span class="cat-badge">${cat.emoji} ${cat.label}</span></td>
      <td>${formatDate(e.date)}</td>
      <td><strong>${fmt(e.amount)}</strong></td>
      <td><button class="delete-btn" onclick="deleteExpense(${e.id})" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button></td>
    </tr>`;
  }).join('');

  buildWeeklyChart(DB.expenses);
}

function renderBudget() {
  const budget = DB.settings.totalBudget || 2000;
  document.getElementById('total-budget-input').value = budget;

  const now = new Date();
  const thisMonthExp = DB.expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
  });

  // Category spending
  const catTotals = {};
  for (const e of thisMonthExp) catTotals[e.category] = (catTotals[e.category]||0)+e.amount;
  const total = Object.values(catTotals).reduce((s,v)=>s+v,0);

  // Budget bars
  const bars = document.getElementById('budget-bars');
  const sorted = Object.entries(catTotals).sort(([,a],[,b])=>b-a).slice(0,5);
  bars.innerHTML = [['total spending', total, budget], ...sorted.map(([k,v])=>[AI.CATEGORIES[k]?.emoji+' '+AI.CATEGORIES[k]?.label, v, budget*0.3])].map(([name, spent, lim]) => {
    const pct = Math.min(100, (spent/lim)*100);
    const color = pct>90?'var(--red)':pct>70?'var(--yellow)':'var(--green)';
    return `<div class="budget-bar-row">
      <div class="budget-bar-label"><span class="budget-bar-name">${name}</span><span class="budget-bar-vals">${fmt(spent)} / ${fmt(lim)}</span></div>
      <div class="budget-bar-track"><div class="budget-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
  }).join('');

  // Forecast
  const fc = AI.forecastNextMonth(DB.expenses);
  document.getElementById('forecast-amount').textContent = fc.months>=1 ? fmt(fc.predicted) : '$—';
  document.getElementById('forecast-confidence').textContent = `${fc.confidence} confidence · ${fc.months} month${fc.months!==1?'s':''} of data`;

  // Forecast breakdown by category
  const fcBreak = document.getElementById('forecast-breakdown');
  fcBreak.innerHTML = sorted.slice(0,4).map(([k,v])=>{
    const cat = AI.CATEGORIES[k]||AI.CATEGORIES.other;
    const trend = fc.slope > 0 ? '↑' : '↓';
    return `<div class="forecast-row"><span>${cat.emoji} ${cat.label}</span><span>${fmt(v)} this month</span></div>`;
  }).join('') || '<div style="color:var(--text-muted);font-size:13px">Add expenses to see forecast</div>';

  // Category budget inputs
  const catGrid = document.getElementById('cat-budget-grid');
  catGrid.innerHTML = Object.entries(AI.CATEGORIES).filter(([k])=>k!=='other').map(([k,cat])=>{
    const saved = DB.settings.categoryBudgets[k]||'';
    const spent = catTotals[k]||0;
    const pct = saved ? Math.min(100,(spent/saved)*100).toFixed(0) : null;
    return `<div class="cat-budget-item">
      <div class="cbi-top"><span class="cbi-emoji">${cat.emoji}</span><span class="cbi-name">${cat.label}</span></div>
      <input type="number" class="cat-budget-input" placeholder="No limit" value="${saved}" data-cat="${k}" min="0" />
      ${pct!==null ? `<div style="margin-top:6px;font-size:11px;color:var(--text-muted)">${fmt(spent)} spent · ${pct}% of limit</div>` : ''}
    </div>`;
  }).join('');

  // Save cat budget on change
  document.querySelectorAll('.cat-budget-input').forEach(inp => {
    inp.addEventListener('change', () => {
      DB.settings.categoryBudgets[inp.dataset.cat] = parseFloat(inp.value)||0;
      DB.save();
    });
  });
}

function renderInsights() {
  const tips = AI.generateTips(DB.expenses, DB.settings.totalBudget);
  const tipsEl = document.getElementById('ai-tips');
  if (tips.length) {
    tipsEl.innerHTML = tips.map(t=>`<div class="tip-item"><div class="tip-icon">${t.icon}</div><div>${t.text}</div></div>`).join('');
  } else {
    tipsEl.innerHTML = '<div class="tip-item"><div class="tip-icon">💡</div><div>Add expenses to receive personalized AI tips.</div></div>';
  }

  // AI Summary
  const score = AI.calcScore(DB.expenses, DB.settings.totalBudget);
  const summaryEl = document.getElementById('ai-summary-text');
  if (DB.expenses.length === 0) {
    summaryEl.textContent = 'Add some expenses to get your personalized AI analysis.';
  } else {
    const now = new Date();
    const thisMonthExp = DB.expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
    });
    const total = thisMonthExp.reduce((s,e)=>s+e.amount,0);
    const catTotals = {};
    for (const e of thisMonthExp) catTotals[e.category] = (catTotals[e.category]||0)+e.amount;
    const top = Object.entries(catTotals).sort(([,a],[,b])=>b-a)[0];
    const fc = AI.forecastNextMonth(DB.expenses);
    const budget = DB.settings.totalBudget||2000;

    summaryEl.innerHTML = `Based on your spending data, you've spent <strong>${fmt(total)}</strong> this month across <strong>${new Set(thisMonthExp.map(e=>e.category)).size}</strong> categories. 
    ${top ? `Your highest expense category is <strong>${AI.CATEGORIES[top[0]]?.emoji} ${AI.CATEGORIES[top[0]]?.label}</strong> at <strong>${fmt(top[1])}</strong>.` : ''} 
    ${fc.months >= 1 ? `AI predicts your next month's expenses at <strong>${fmt(fc.predicted)}</strong> with ${fc.confidence} confidence.` : ''}
    ${total > budget ? `⚠️ You've exceeded your monthly budget by <strong>${fmt(total-budget)}</strong>.` : `You're <strong>${fmt(budget-total)}</strong> within your monthly budget.`}`;
  }

  // Financial Health Score
  if (score !== null) {
    document.getElementById('score-value').textContent = score;
    const circle = document.getElementById('score-circle');
    const circumference = 251.2;
    const offset = circumference - (score/100)*circumference;
    circle.style.strokeDashoffset = offset;
    const label = score >= 75 ? 'Excellent' : score >= 55 ? 'Good' : score >= 35 ? 'Fair' : 'Needs Work';
    document.getElementById('score-label').textContent = `Financial Health: ${label}`;
    document.getElementById('score-desc').textContent = `Score based on budget adherence, expense diversity & tracking consistency`;
  }

  // Spending Heatmap
  const pattern = AI.dayOfWeekPattern(DB.expenses);
  const maxAmt = Math.max(...pattern.map(p=>p.total), 1);
  const heatmap = document.getElementById('heatmap');
  heatmap.innerHTML = pattern.map(p => {
    const intensity = p.total/maxAmt;
    const alpha = 0.07 + intensity*0.55;
    return `<div class="heat-cell" style="background:rgba(99,102,241,${alpha.toFixed(2)})">
      <span class="day-label">${p.day}</span>
      <span class="day-val">${p.total>0?'$'+Math.round(p.total):'-'}</span>
    </div>`;
  }).join('');

  // Category Intelligence
  const now = new Date();
  const thisMonthExp = DB.expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
  });
  const total = thisMonthExp.reduce((s,e)=>s+e.amount,0)||1;
  const catTotals = {};
  for (const e of thisMonthExp) catTotals[e.category] = (catTotals[e.category]||0)+e.amount;
  const intelEl = document.getElementById('category-intel');
  const sortedCats = Object.entries(catTotals).sort(([,a],[,b])=>b-a).slice(0,6);
  intelEl.innerHTML = sortedCats.map(([k,v])=>{
    const cat = AI.CATEGORIES[k]||AI.CATEGORIES.other;
    const pct = ((v/total)*100).toFixed(0);
    return `<div class="intel-item">
      <div class="intel-top"><span class="intel-cat">${cat.emoji} ${cat.label}</span><span class="intel-pct">${pct}%</span></div>
      <div class="intel-amount">${fmt(v)}</div>
      <div class="intel-bar-track"><div class="intel-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('') || '<div style="color:var(--text-muted);font-size:13px">Add expenses to see category intelligence</div>';

  // Update badge
  document.getElementById('insights-badge').textContent = tips.length || '0';
}

// ──────────────────────────────────────────────
// 6. MODAL
// ──────────────────────────────────────────────
let selectedCategory = '';
let aiSuggestedCat = '';
let aiTypingTimer = null;

function openModal() {
  const modal = document.getElementById('modal-overlay');
  modal.classList.add('active');
  // Set today as default date
  document.getElementById('expense-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('expense-desc').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.getElementById('expense-desc').value = '';
  document.getElementById('expense-amount').value = '';
  document.getElementById('expense-notes').value = '';
  document.getElementById('ai-suggestion').style.display = 'none';
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
  selectedCategory = '';
  aiSuggestedCat = '';
}

function saveExpense() {
  const desc   = document.getElementById('expense-desc').value.trim();
  const amount = parseFloat(document.getElementById('expense-amount').value);
  const date   = document.getElementById('expense-date').value;
  const notes  = document.getElementById('expense-notes').value.trim();

  if (!desc) { showToast('Please enter a description', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); return; }
  if (!date) { showToast('Please select a date', 'error'); return; }

  const category = selectedCategory || aiSuggestedCat || 'other';

  DB.addExpense({ description: desc, amount, date, notes, category });
  closeModal();
  showToast(`Expense added! AI categorized as ${AI.CATEGORIES[category]?.label} ${AI.CATEGORIES[category]?.emoji}`);
  renderDashboard();
  renderExpensesPage();
}

window.deleteExpense = function(id) {
  DB.deleteExpense(id);
  showToast('Expense deleted', 'error');
  renderDashboard();
  renderExpensesPage();
};

// ──────────────────────────────────────────────
// 7. UTILS
// ──────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(dateStr) {
  const d = new Date(dateStr+'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ──────────────────────────────────────────────
// 8. DEMO DATA (first time)
// ──────────────────────────────────────────────
function seedDemoData() {
  if (DB.expenses.length > 0) return;
  const now = new Date();
  const demo = [
    { description: 'Chipotle lunch bowls', amount: 28.50, category: 'food',          date: getRelDate(0),  notes: '' },
    { description: 'Uber ride to airport',  amount: 42.00, category: 'transport',    date: getRelDate(1),  notes: '' },
    { description: 'Netflix subscription',  amount: 15.99, category: 'bills',        date: getRelDate(2),  notes: 'Monthly' },
    { description: 'Amazon shopping order', amount: 89.99, category: 'shopping',     date: getRelDate(2),  notes: 'Electronics' },
    { description: 'Planet Fitness gym',    amount: 24.99, category: 'fitness',      date: getRelDate(3),  notes: '' },
    { description: 'Walmart groceries',     amount: 134.20, category: 'food',        date: getRelDate(3),  notes: 'Weekly groceries' },
    { description: 'Doctor visit copay',    amount: 30.00, category: 'health',       date: getRelDate(5),  notes: '' },
    { description: 'Spotify Premium',       amount: 9.99,  category: 'entertainment',date: getRelDate(5),  notes: '' },
    { description: 'Electric bill',         amount: 87.00, category: 'bills',        date: getRelDate(6),  notes: 'January bill' },
    { description: 'Starbucks coffee',      amount: 6.75,  category: 'food',         date: getRelDate(6),  notes: '' },
    { description: 'Online Python course',  amount: 49.99, category: 'education',    date: getRelDate(7),  notes: 'Udemy' },
    { description: 'Gas station fillup',    amount: 55.30, category: 'transport',    date: getRelDate(8),  notes: '' },
    { description: 'Dinner at Olive Garden',amount: 67.80, category: 'food',         date: getRelDate(10), notes: '' },
    { description: 'Robinhood investment',  amount: 200.00,category: 'investments',  date: getRelDate(12), notes: 'Monthly DCA' },
    { description: 'Hotel booking NYC',     amount: 189.00,category: 'travel',       date: getRelDate(15), notes: '2 nights' },
    { description: 'Haircut & styling',     amount: 35.00, category: 'personal',     date: getRelDate(15), notes: '' },
    { description: 'Grocery run Kroger',    amount: 78.40, category: 'food',         date: getRelDate(-27), notes: '' },
    { description: 'Bus pass monthly',      amount: 52.00, category: 'transport',    date: getRelDate(-28), notes: '' },
    { description: 'Movie tickets',         amount: 32.00, category: 'entertainment',date: getRelDate(-29), notes: '' },
    { description: 'Internet bill AT&T',    amount: 65.00, category: 'bills',        date: getRelDate(-30), notes: '' },
  ];

  demo.forEach(exp => {
    exp.id = Date.now() + Math.random();
    DB.expenses.push(exp);
  });
  DB.save();
}

function getRelDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// ──────────────────────────────────────────────
// 9. EVENT LISTENERS
// ──────────────────────────────────────────────
function init() {
  DB.load();
  seedDemoData();

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigate(item.dataset.page);
    });
  });

  // Dashboard view-all link
  document.querySelectorAll('.link-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      navigate(btn.dataset.page);
    });
  });

  // Add expense buttons
  ['add-expense-btn', 'add-expense-btn-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', openModal);
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  // AI auto-categorize on typing
  const descInput = document.getElementById('expense-desc');
  descInput.addEventListener('input', () => {
    clearTimeout(aiTypingTimer);
    const val = descInput.value.trim();
    if (val.length < 3) {
      document.getElementById('ai-suggestion').style.display = 'none';
      return;
    }
    aiTypingTimer = setTimeout(() => {
      const result = AI.categorize(val);
      if (result.category !== 'other' || result.score > 0) {
        const cat = AI.CATEGORIES[result.category];
        document.getElementById('ai-suggestion-text').textContent =
          `Suggested: ${cat.emoji} ${cat.label} (${result.confidence} confidence)`;
        document.getElementById('ai-suggestion').style.display = 'flex';
        aiSuggestedCat = result.category;
      } else {
        document.getElementById('ai-suggestion').style.display = 'none';
      }
    }, 350);
  });

  // Accept AI suggestion
  document.getElementById('accept-category').addEventListener('click', () => {
    selectCategory(aiSuggestedCat);
    document.getElementById('ai-suggestion').style.display = 'none';
  });

  // Category buttons
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => selectCategory(btn.dataset.cat));
  });

  function selectCategory(cat) {
    selectedCategory = cat;
    document.querySelectorAll('.cat-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.cat === cat);
    });
  }

  // Save expense
  document.getElementById('save-expense-btn').addEventListener('click', saveExpense);
  document.getElementById('expense-amount').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveExpense();
  });

  // Budget save
  document.getElementById('save-budget-btn').addEventListener('click', () => {
    const val = parseFloat(document.getElementById('total-budget-input').value);
    if (!isNaN(val) && val > 0) {
      DB.settings.totalBudget = val;
      DB.save();
      renderBudget();
      renderDashboard();
      showToast('Budget saved!');
    }
  });

  // Expense filters
  ['search-input','filter-category','filter-period'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderExpensesPage);
    if (el) el.addEventListener('change', renderExpensesPage);
  });

  // Refresh insights
  document.getElementById('refresh-insights-btn').addEventListener('click', () => {
    renderInsights();
    showToast('AI Insights refreshed!');
  });

  // Initial render
  renderDashboard();
  renderExpensesPage();
}

document.addEventListener('DOMContentLoaded', init);
