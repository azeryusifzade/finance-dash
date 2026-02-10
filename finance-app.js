// Finance Flow - Personal Money Tracker
// ============================================================================

// Storage Manager
const Storage = {
    getTransactions() {
        try {
            return JSON.parse(localStorage.getItem('financeTransactions') || '[]');
        } catch (e) {
            console.error('Error reading transactions:', e);
            return [];
        }
    },
    saveTransactions(transactions) {
        try {
            localStorage.setItem('financeTransactions', JSON.stringify(transactions));
        } catch (e) {
            console.error('Error saving transactions:', e);
            Toast.show('Error saving data. Storage may be full.');
        }
    },
    addTransaction(transaction) {
        const transactions = this.getTransactions();
        transactions.push({ ...transaction, id: Date.now() });
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        this.saveTransactions(transactions);
        return transactions;
    },
    deleteTransaction(id) {
        const filtered = this.getTransactions().filter(t => t.id !== id);
        this.saveTransactions(filtered);
        return filtered;
    },
    getBudgets() {
        try {
            return JSON.parse(localStorage.getItem('financeBudgets') || '[]');
        } catch (e) {
            console.error('Error reading budgets:', e);
            return [];
        }
    },
    saveBudgets(budgets) {
        localStorage.setItem('financeBudgets', JSON.stringify(budgets));
    },
    addBudget(budget) {
        const budgets = this.getBudgets();
        budgets.push({ ...budget, id: Date.now() });
        this.saveBudgets(budgets);
        return budgets;
    },
    deleteBudget(id) {
        const filtered = this.getBudgets().filter(b => b.id !== id);
        this.saveBudgets(filtered);
        return filtered;
    }
};

// Toast Notification System
const Toast = {
    show(message) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');
        
        if (!toast || !toastMessage) return;
        
        toastMessage.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
};

// Theme Manager
const ThemeManager = {
    init() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
        document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
    },
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    },
    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        this.setTheme(current === 'light' ? 'dark' : 'light');
    }
};

// Chart Management
let charts = {};
let currentPeriod = 30;

function destroyChart(chartId) {
    if (charts[chartId]) {
        try {
            charts[chartId].destroy();
        } catch (e) {
            console.error('Error destroying chart:', chartId, e);
        }
        delete charts[chartId];
    }
}

function destroyAllCharts() {
    Object.keys(charts).forEach(chartId => destroyChart(chartId));
}

// Currency Formatter
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Date Helpers
function getMonthStart(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function filterTransactionsByPeriod(transactions, days) {
    if (days === 'all') return transactions;
    
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return transactions.filter(t => new Date(t.date) >= cutoff);
}

// Calculate Financial Stats
function calculateStats(transactions, period = 'month') {
    let filtered = transactions;
    
    if (period === 'month') {
        const monthStart = getMonthStart();
        filtered = transactions.filter(t => new Date(t.date) >= monthStart);
    }
    
    const income = filtered
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const expenses = filtered
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    return {
        income,
        expenses,
        balance: income - expenses,
        count: filtered.length
    };
}

// Dashboard Rendering
function renderDashboard() {
    const dateDisplay = document.getElementById('current-date');
    if (dateDisplay) {
        const today = new Date();
        dateDisplay.textContent = today.toLocaleDateString('en-US', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }
    
    const transactions = Storage.getTransactions();
    const monthStats = calculateStats(transactions, 'month');
    const totalStats = calculateStats(transactions, 'all');
    
    // Update balance cards
    document.getElementById('total-balance').textContent = formatCurrency(totalStats.balance);
    document.getElementById('month-income').textContent = formatCurrency(monthStats.income);
    document.getElementById('month-expenses').textContent = formatCurrency(monthStats.expenses);
    
    // Quick Stats
    const avgExpense = monthStats.count > 0 ? monthStats.expenses / monthStats.count : 0;
    const savingsRate = monthStats.income > 0 ? ((monthStats.income - monthStats.expenses) / monthStats.income * 100) : 0;
    
    const quickStatsHtml = `
        <div class="stat-card">
            <div class="stat-label">Total Transactions</div>
            <div class="stat-value">${transactions.length}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">This Month</div>
            <div class="stat-value">${monthStats.count}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Avg Transaction</div>
            <div class="stat-value">${formatCurrency(avgExpense)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Savings Rate</div>
            <div class="stat-value">${savingsRate.toFixed(1)}%</div>
        </div>
    `;
    
    document.getElementById('quick-stats').innerHTML = quickStatsHtml;
    
    // Charts
    createCategoryChart();
    createIncomeExpenseChart();
    
    // Recent Transactions
    renderRecentTransactions();
    
    // Budget Overview
    renderBudgetOverview();
}

function createCategoryChart() {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;
    
    destroyChart('categoryChart');
    
    const transactions = Storage.getTransactions();
    const monthStart = getMonthStart();
    const monthTransactions = transactions.filter(t => 
        t.type === 'expense' && new Date(t.date) >= monthStart
    );
    
    const categoryTotals = monthTransactions.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
        return acc;
    }, {});
    
    const sortedCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    
    if (sortedCategories.length === 0) {
        canvas.parentElement.innerHTML = '<div class="no-data"><p>No expense data for this month</p></div>';
        return;
    }
    
    const colors = [
        '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
        '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
    ];
    
    try {
        charts.categoryChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: sortedCategories.map(c => c[0]),
                datasets: [{
                    data: sortedCategories.map(c => c[1]),
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom', labels: { padding: 10, font: { size: 11 } } },
                    tooltip: { 
                        callbacks: { 
                            label: (context) => `${context.label}: ${formatCurrency(context.parsed)}` 
                        } 
                    }
                }
            }
        });
    } catch (e) {
        console.error('Error creating category chart:', e);
    }
}

function createIncomeExpenseChart() {
    const canvas = document.getElementById('incomeExpenseChart');
    if (!canvas) return;
    
    destroyChart('incomeExpenseChart');
    
    const transactions = Storage.getTransactions();
    const last6Months = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = getMonthStart(date);
        const monthEnd = getMonthEnd(date);
        
        const monthTransactions = transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= monthStart && tDate <= monthEnd;
        });
        
        const income = monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        const expenses = monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        last6Months.push({
            label: date.toLocaleDateString('en-US', { month: 'short' }),
            income,
            expenses
        });
    }
    
    try {
        charts.incomeExpenseChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: last6Months.map(m => m.label),
                datasets: [
                    {
                        label: 'Income',
                        data: last6Months.map(m => m.income),
                        backgroundColor: '#10b981',
                        borderRadius: 6
                    },
                    {
                        label: 'Expenses',
                        data: last6Months.map(m => m.expenses),
                        backgroundColor: '#ef4444',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: true },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatCurrency(value)
                        }
                    }
                }
            }
        });
    } catch (e) {
        console.error('Error creating income/expense chart:', e);
    }
}

function renderRecentTransactions() {
    const container = document.getElementById('transactions-container');
    if (!container) return;
    
    const transactions = Storage.getTransactions().slice(0, 10);
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="no-data"><p>No transactions yet</p></div>';
        return;
    }
    
    container.innerHTML = transactions.map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-category">${t.category}</div>
                <div class="transaction-details">
                    <span>${new Date(t.date).toLocaleDateString()}</span>
                    ${t.description ? `<span>• ${t.description}</span>` : ''}
                </div>
            </div>
            <div class="transaction-amount ${t.type}">
                ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
            </div>
        </div>
    `).join('');
}

function renderBudgetOverview() {
    const container = document.getElementById('budget-overview');
    if (!container) return;
    
    const budgets = Storage.getBudgets();
    const transactions = Storage.getTransactions();
    const monthStart = getMonthStart();
    
    if (budgets.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const budgetHtml = budgets.map(budget => {
        const spent = transactions
            .filter(t => t.type === 'expense' && t.category === budget.category && new Date(t.date) >= monthStart)
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        const percentage = (spent / budget.amount) * 100;
        const status = percentage >= 100 ? 'danger' : percentage >= 80 ? 'warning' : 'success';
        
        return `
            <div class="budget-card">
                <div class="budget-header">
                    <div class="budget-category">${budget.category}</div>
                </div>
                <div class="budget-amounts">
                    <span>${formatCurrency(spent)} spent</span>
                    <span>${formatCurrency(budget.amount)} limit</span>
                </div>
                <div class="budget-progress-bar">
                    <div class="budget-progress-fill ${status}" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <h3>Budget Status</h3>
        ${budgetHtml}
    `;
}

// Transaction Form
function initializeTransactionForm() {
    const form = document.getElementById('transaction-form');
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('trans-date').value = today;
    
    // Transaction type buttons
    document.querySelectorAll('[data-type]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    form.addEventListener('submit', handleTransactionSubmit);
}

function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const typeBtn = document.querySelector('[data-type].active');
    
    const transaction = {
        type: typeBtn.dataset.type,
        date: document.getElementById('trans-date').value,
        amount: parseFloat(document.getElementById('trans-amount').value),
        category: document.getElementById('trans-category').value,
        paymentMethod: document.getElementById('trans-payment').value,
        description: document.getElementById('trans-description').value,
        notes: document.getElementById('trans-notes').value,
        timestamp: new Date().toISOString()
    };
    
    Storage.addTransaction(transaction);
    Toast.show('Transaction added successfully!');
    
    // Reset form
    e.target.reset();
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
    
    setTimeout(() => { switchView('dashboard'); }, 500);
}

// All Transactions View
function renderAllTransactions() {
    const container = document.getElementById('all-transactions');
    if (!container) return;
    
    const filterType = document.getElementById('filter-type').value;
    const filterCategory = document.getElementById('filter-category').value;
    const filterPeriod = document.getElementById('filter-period').value;
    
    let transactions = Storage.getTransactions();
    
    // Apply filters
    if (filterType !== 'all') {
        transactions = transactions.filter(t => t.type === filterType);
    }
    
    if (filterCategory !== 'all') {
        transactions = transactions.filter(t => t.category === filterCategory);
    }
    
    if (filterPeriod !== 'all') {
        transactions = filterTransactionsByPeriod(transactions, parseInt(filterPeriod));
    }
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="no-data"><h3>No Transactions Found</h3><p>Try adjusting your filters</p></div>';
        return;
    }
    
    container.innerHTML = transactions.map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-category">${t.category}</div>
                <div class="transaction-details">
                    <span>${new Date(t.date).toLocaleDateString()}</span>
                    ${t.description ? `<span>• ${t.description}</span>` : ''}
                    <span>• ${t.paymentMethod}</span>
                </div>
            </div>
            <div class="transaction-amount ${t.type}">
                ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
            </div>
            <button class="transaction-delete" data-id="${t.id}">×</button>
        </div>
    `).join('');
    
    // Add delete handlers
    container.querySelectorAll('.transaction-delete').forEach(btn => {
        btn.addEventListener('click', function() {
            if (confirm('Delete this transaction?')) {
                Storage.deleteTransaction(parseInt(this.dataset.id));
                Toast.show('Transaction deleted');
                renderAllTransactions();
                renderDashboard();
            }
        });
    });
}

function initializeFilters() {
    // Populate category filter
    const categoryFilter = document.getElementById('filter-category');
    const transactions = Storage.getTransactions();
    const categories = [...new Set(transactions.map(t => t.category))].sort();
    
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
    
    // Add filter change listeners
    ['filter-type', 'filter-category', 'filter-period'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', renderAllTransactions);
    });
}

// Budget Management
function renderBudgets() {
    const container = document.getElementById('budgets-container');
    if (!container) return;
    
    const budgets = Storage.getBudgets();
    const transactions = Storage.getTransactions();
    const monthStart = getMonthStart();
    
    if (budgets.length === 0) {
        container.innerHTML = '<div class="no-data"><h3>No Budgets Set</h3><p>Create your first budget to start tracking</p></div>';
        return;
    }
    
    container.innerHTML = budgets.map(budget => {
        const spent = transactions
            .filter(t => t.type === 'expense' && t.category === budget.category && new Date(t.date) >= monthStart)
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        const percentage = (spent / budget.amount) * 100;
        const remaining = budget.amount - spent;
        const status = percentage >= 100 ? 'danger' : percentage >= 80 ? 'warning' : 'success';
        
        return `
            <div class="budget-card">
                <div class="budget-header">
                    <div class="budget-category">${budget.category}</div>
                    <button class="budget-delete" data-id="${budget.id}">×</button>
                </div>
                <div class="budget-amounts">
                    <span>${formatCurrency(spent)} of ${formatCurrency(budget.amount)}</span>
                    <span>${formatCurrency(remaining)} remaining</span>
                </div>
                <div class="budget-progress-bar">
                    <div class="budget-progress-fill ${status}" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
            </div>
        `;
    }).join('');
    
    container.querySelectorAll('.budget-delete').forEach(btn => {
        btn.addEventListener('click', function() {
            if (confirm('Delete this budget?')) {
                Storage.deleteBudget(parseInt(this.dataset.id));
                Toast.show('Budget deleted');
                renderBudgets();
            }
        });
    });
}

function initializeBudgetModal() {
    const modal = document.getElementById('budget-modal');
    const addBtn = document.getElementById('add-budget-btn');
    const closeBtn = document.getElementById('close-budget-modal');
    const cancelBtn = document.getElementById('cancel-budget');
    const form = document.getElementById('add-budget-form');
    
    if (!addBtn || !modal) return;
    
    addBtn.addEventListener('click', () => {
        modal.classList.add('active');
    });
    
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const budget = {
                category: document.getElementById('budget-category').value,
                amount: parseFloat(document.getElementById('budget-amount').value)
            };
            
            Storage.addBudget(budget);
            Toast.show('Budget created successfully!');
            renderBudgets();
            modal.classList.remove('active');
            form.reset();
        });
    }
}

// Analytics View
function renderAnalytics() {
    const transactions = Storage.getTransactions();
    
    if (transactions.length === 0) {
        document.getElementById('analytics-summary').innerHTML = '<div class="no-data"><h3>No Data Yet</h3><p>Add transactions to see analytics</p></div>';
        return;
    }
    
    try {
        createMonthlyTrendsChart();
        createCategoryBreakdownChart();
        createDailySpendingChart();
        createPaymentMethodsChart();
        createIncomeSourcesChart();
        createSavingsRateChart();
        renderAnalyticsSummary();
    } catch (error) {
        console.error('Error creating analytics charts:', error);
        Toast.show('Error loading analytics');
    }
}

function createMonthlyTrendsChart() {
    const canvas = document.getElementById('monthlyTrendsChart');
    if (!canvas) return;
    
    destroyChart('monthlyTrendsChart');
    
    const transactions = filterTransactionsByPeriod(Storage.getTransactions(), currentPeriod);
    const dailyData = {};
    
    transactions.forEach(t => {
        const date = t.date;
        if (!dailyData[date]) {
            dailyData[date] = { income: 0, expenses: 0 };
        }
        
        if (t.type === 'income') {
            dailyData[date].income += parseFloat(t.amount);
        } else {
            dailyData[date].expenses += parseFloat(t.amount);
        }
    });
    
    const sortedDates = Object.keys(dailyData).sort();
    
    try {
        charts.monthlyTrendsChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: sortedDates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
                datasets: [
                    {
                        label: 'Income',
                        data: sortedDates.map(d => dailyData[d].income),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Expenses',
                        data: sortedDates.map(d => dailyData[d].expenses),
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`
                        }
                    }
                }
            }
        });
    } catch (e) {
        console.error('Error creating monthly trends chart:', e);
    }
}

function createCategoryBreakdownChart() {
    const canvas = document.getElementById('categoryBreakdownChart');
    if (!canvas) return;
    
    destroyChart('categoryBreakdownChart');
    
    const transactions = filterTransactionsByPeriod(Storage.getTransactions(), currentPeriod);
    const expenses = transactions.filter(t => t.type === 'expense');
    
    const categoryTotals = expenses.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
        return acc;
    }, {});
    
    const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    
    try {
        charts.categoryBreakdownChart = new Chart(canvas, {
            type: 'pie',
            data: {
                labels: sortedCategories.map(c => c[0]),
                datasets: [{
                    data: sortedCategories.map(c => c[1]),
                    backgroundColor: colors
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.label}: ${formatCurrency(context.parsed)}`
                        }
                    }
                }
            }
        });
    } catch (e) {
        console.error('Error creating category breakdown chart:', e);
    }
}

function createDailySpendingChart() {
    const canvas = document.getElementById('dailySpendingChart');
    if (!canvas) return;
    
    destroyChart('dailySpendingChart');
    
    const transactions = filterTransactionsByPeriod(Storage.getTransactions(), currentPeriod);
    const expenses = transactions.filter(t => t.type === 'expense');
    
    const dailyTotals = expenses.reduce((acc, t) => {
        acc[t.date] = (acc[t.date] || 0) + parseFloat(t.amount);
        return acc;
    }, {});
    
    const dates = Object.keys(dailyTotals).sort();
    
    try {
        charts.dailySpendingChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
                datasets: [{
                    label: 'Daily Spending',
                    data: dates.map(d => dailyTotals[d]),
                    backgroundColor: '#ef4444',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => formatCurrency(context.parsed.y)
                        }
                    }
                }
            }
        });
    } catch (e) {
        console.error('Error creating daily spending chart:', e);
    }
}

function createPaymentMethodsChart() {
    const canvas = document.getElementById('paymentMethodsChart');
    if (!canvas) return;
    
    destroyChart('paymentMethodsChart');
    
    const transactions = filterTransactionsByPeriod(Storage.getTransactions(), currentPeriod);
    
    const methodCounts = transactions.reduce((acc, t) => {
        acc[t.paymentMethod] = (acc[t.paymentMethod] || 0) + 1;
        return acc;
    }, {});
    
    try {
        charts.paymentMethodsChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: Object.keys(methodCounts),
                datasets: [{
                    data: Object.values(methodCounts),
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    } catch (e) {
        console.error('Error creating payment methods chart:', e);
    }
}

function createIncomeSourcesChart() {
    const canvas = document.getElementById('incomeSourcesChart');
    if (!canvas) return;
    
    destroyChart('incomeSourcesChart');
    
    const transactions = filterTransactionsByPeriod(Storage.getTransactions(), currentPeriod);
    const income = transactions.filter(t => t.type === 'income');
    
    const sourceTotals = income.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
        return acc;
    }, {});
    
    try {
        charts.incomeSourcesChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: Object.keys(sourceTotals),
                datasets: [{
                    label: 'Income by Source',
                    data: Object.values(sourceTotals),
                    backgroundColor: '#10b981',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => formatCurrency(context.parsed.y)
                        }
                    }
                }
            }
        });
    } catch (e) {
        console.error('Error creating income sources chart:', e);
    }
}

function createSavingsRateChart() {
    const canvas = document.getElementById('savingsRateChart');
    if (!canvas) return;
    
    destroyChart('savingsRateChart');
    
    const transactions = Storage.getTransactions();
    const last6Months = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = getMonthStart(date);
        const monthEnd = getMonthEnd(date);
        
        const monthTransactions = transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= monthStart && tDate <= monthEnd;
        });
        
        const income = monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        const expenses = monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        const savingsRate = income > 0 ? ((income - expenses) / income * 100) : 0;
        
        last6Months.push({
            label: date.toLocaleDateString('en-US', { month: 'short' }),
            savingsRate
        });
    }
    
    try {
        charts.savingsRateChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: last6Months.map(m => m.label),
                datasets: [{
                    label: 'Savings Rate %',
                    data: last6Months.map(m => m.savingsRate),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: (value) => value + '%'
                        }
                    }
                }
            }
        });
    } catch (e) {
        console.error('Error creating savings rate chart:', e);
    }
}

function renderAnalyticsSummary() {
    const container = document.getElementById('analytics-summary');
    if (!container) return;
    
    const transactions = filterTransactionsByPeriod(Storage.getTransactions(), currentPeriod);
    const stats = calculateStats(transactions, 'all');
    
    const avgTransaction = stats.count > 0 ? stats.expenses / stats.count : 0;
    const highestExpense = Math.max(...transactions.filter(t => t.type === 'expense').map(t => parseFloat(t.amount)), 0);
    const topCategory = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
            return acc;
        }, {});
    const topCat = Object.entries(topCategory).sort((a, b) => b[1] - a[1])[0];
    
    container.innerHTML = `
        <h3>Summary Statistics (${currentPeriod === 'all' ? 'All Time' : currentPeriod + ' Days'})</h3>
        <div class="summary-item"><span class="summary-label">Total Income</span><span class="summary-value">${formatCurrency(stats.income)}</span></div>
        <div class="summary-item"><span class="summary-label">Total Expenses</span><span class="summary-value">${formatCurrency(stats.expenses)}</span></div>
        <div class="summary-item"><span class="summary-label">Net Balance</span><span class="summary-value">${formatCurrency(stats.balance)}</span></div>
        <div class="summary-item"><span class="summary-label">Total Transactions</span><span class="summary-value">${stats.count}</span></div>
        <div class="summary-item"><span class="summary-label">Average Transaction</span><span class="summary-value">${formatCurrency(avgTransaction)}</span></div>
        <div class="summary-item"><span class="summary-label">Highest Expense</span><span class="summary-value">${formatCurrency(highestExpense)}</span></div>
        ${topCat ? `<div class="summary-item"><span class="summary-label">Top Category</span><span class="summary-value">${topCat[0]}</span></div>` : ''}
    `;
}

// Excel/CSV Import
function initializeImport() {
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('import-file');
    const downloadBtn = document.getElementById('download-template-btn');
    
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            document.getElementById('file-info').innerHTML = `
                <strong>Selected:</strong> ${file.name} (${(file.size / 1024).toFixed(2)} KB)
                <br><button id="process-file-btn" class="btn-primary mt-4">Process File</button>
            `;
            
            document.getElementById('process-file-btn').addEventListener('click', () => {
                processImportFile(file);
            });
        });
    }
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadTemplate);
    }
}

function processImportFile(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            
            const preview = document.getElementById('import-preview');
            preview.innerHTML = `
                <h3>Preview (${jsonData.length} transactions found)</h3>
                <p>Click confirm to import these transactions</p>
                <div style="max-height: 300px; overflow-y: auto; margin: 1rem 0;">
                    ${jsonData.slice(0, 10).map(row => `
                        <div class="transaction-item">
                            <div class="transaction-info">
                                <div class="transaction-category">${row.Category || 'Unknown'}</div>
                                <div class="transaction-details">
                                    <span>${row.Date || 'No date'}</span>
                                    ${row.Description ? `<span>• ${row.Description}</span>` : ''}
                                </div>
                            </div>
                            <div class="transaction-amount ${row.Type || 'expense'}">
                                ${formatCurrency(row.Amount || 0)}
                            </div>
                        </div>
                    `).join('')}
                    ${jsonData.length > 10 ? `<p style="text-align: center; color: var(--text-secondary);">...and ${jsonData.length - 10} more</p>` : ''}
                </div>
                <button id="confirm-import-btn" class="btn-primary">Confirm Import</button>
                <button id="cancel-import-btn" class="btn-secondary">Cancel</button>
            `;
            
            document.getElementById('confirm-import-btn').addEventListener('click', () => {
                importTransactions(jsonData);
            });
            
            document.getElementById('cancel-import-btn').addEventListener('click', () => {
                preview.innerHTML = '';
                document.getElementById('file-info').innerHTML = '';
                document.getElementById('import-file').value = '';
            });
            
        } catch (error) {
            console.error('Error processing file:', error);
            Toast.show('Error processing file. Please check the format.');
        }
    };
    
    reader.readAsArrayBuffer(file);
}

function importTransactions(data) {
    let imported = 0;
    let skipped = 0;
    
    data.forEach(row => {
        try {
            // Normalize date format
            let date = row.Date || row.date;
            if (date) {
                // Handle Excel date serial numbers
                if (typeof date === 'number') {
                    const excelEpoch = new Date(1900, 0, 1);
                    const days = date - 2; // Excel date offset
                    const jsDate = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
                    date = jsDate.toISOString().split('T')[0];
                } else {
                    // Try to parse date string
                    const parsedDate = new Date(date);
                    if (!isNaN(parsedDate)) {
                        date = parsedDate.toISOString().split('T')[0];
                    }
                }
            }
            
            const transaction = {
                date: date || new Date().toISOString().split('T')[0],
                amount: parseFloat(row.Amount || row.amount || 0),
                category: row.Category || row.category || 'Other Expense',
                type: (row.Type || row.type || 'expense').toLowerCase(),
                paymentMethod: row['Payment Method'] || row.paymentMethod || 'Cash',
                description: row.Description || row.description || '',
                notes: row.Notes || row.notes || '',
                timestamp: new Date().toISOString()
            };
            
            if (transaction.amount > 0) {
                Storage.addTransaction(transaction);
                imported++;
            } else {
                skipped++;
            }
        } catch (error) {
            console.error('Error importing row:', row, error);
            skipped++;
        }
    });
    
    Toast.show(`Imported ${imported} transactions, skipped ${skipped}`);
    document.getElementById('import-preview').innerHTML = '';
    document.getElementById('file-info').innerHTML = '';
    document.getElementById('import-file').value = '';
    
    switchView('dashboard');
}

function downloadTemplate() {
    const template = [
        { 
            Date: '2024-01-15', 
            Amount: 50.00, 
            Category: 'Food & Dining', 
            Type: 'expense',
            'Payment Method': 'Credit Card',
            Description: 'Lunch at restaurant',
            Notes: 'Business lunch'
        },
        { 
            Date: '2024-01-16', 
            Amount: 3000.00, 
            Category: 'Salary', 
            Type: 'income',
            'Payment Method': 'Bank Transfer',
            Description: 'Monthly salary',
            Notes: ''
        }
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    
    XLSX.writeFile(wb, 'finance-tracker-template.xlsx');
}

// Settings
function initializeSettings() {
    const settingsBtn = document.getElementById('settings-btn');
    const modal = document.getElementById('settings-modal');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-json-btn');
    const importFile = document.getElementById('import-json-file');
    const clearBtn = document.getElementById('clear-data-btn');
    
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            modal.classList.add('active');
            updateAppStats();
        });
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const data = {
                transactions: Storage.getTransactions(),
                budgets: Storage.getBudgets(),
                exportDate: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `finance-tracker-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            Toast.show('Data exported successfully!');
        });
    }
    
    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => importFile.click());
        
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (data.transactions) Storage.saveTransactions(data.transactions);
                    if (data.budgets) Storage.saveBudgets(data.budgets);
                    
                    Toast.show('Data imported successfully!');
                    modal.classList.remove('active');
                    switchView('dashboard');
                } catch (error) {
                    Toast.show('Error importing data. Please check the file format.');
                }
            };
            reader.readAsText(file);
            importFile.value = '';
        });
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
                localStorage.clear();
                Toast.show('All data cleared');
                modal.classList.remove('active');
                switchView('dashboard');
            }
        });
    }
}

function updateAppStats() {
    const statsContainer = document.getElementById('app-stats');
    if (!statsContainer) return;
    
    const transactions = Storage.getTransactions();
    const budgets = Storage.getBudgets();
    
    const dataSize = new Blob([JSON.stringify({ transactions, budgets })]).size;
    const dataSizeKB = (dataSize / 1024).toFixed(2);
    
    statsContainer.innerHTML = `
        <div class="summary-item"><span class="summary-label">Total Transactions</span><span class="summary-value">${transactions.length}</span></div>
        <div class="summary-item"><span class="summary-label">Active Budgets</span><span class="summary-value">${budgets.length}</span></div>
        <div class="summary-item"><span class="summary-label">Data Size</span><span class="summary-value">${dataSizeKB} KB</span></div>
    `;
}

// View Switching
function switchView(viewName) {
    console.log('Switching to view:', viewName);
    
    try {
        if (viewName !== 'analytics' && viewName !== 'dashboard') {
            destroyAllCharts();
        }
        
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        
        const view = document.getElementById(`${viewName}-view`);
        if (view) {
            view.classList.add('active');
        } else {
            console.error('View not found:', viewName);
        }
        
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-view="${viewName}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        
        switch(viewName) {
            case 'dashboard':
                renderDashboard();
                break;
            case 'transactions':
                renderAllTransactions();
                break;
            case 'budget':
                renderBudgets();
                break;
            case 'analytics':
                renderAnalytics();
                break;
        }
    } catch (error) {
        console.error('Error switching view:', error);
        Toast.show('Error loading view. Please try again.');
    }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Finance Tracker initializing...');
    
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded!');
        Toast.show('Chart library failed to load.');
    }
    
    if (typeof XLSX === 'undefined') {
        console.error('XLSX library is not loaded!');
        Toast.show('Excel import library failed to load.');
    }
    
    ThemeManager.init();
    
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const viewName = this.dataset.view;
            switchView(viewName);
        });
    });
    
    // Initialize components
    initializeTransactionForm();
    initializeFilters();
    initializeBudgetModal();
    initializeSettings();
    initializeImport();
    
    // Period selector for analytics
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentPeriod = this.dataset.period === 'all' ? 'all' : parseInt(this.dataset.period);
            renderAnalytics();
        });
    });
    
    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').classList.remove('active');
        });
    });
    
    // Close modals on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('active');
        });
    });
    
    // Initial render
    renderDashboard();
    
    console.log('Finance Tracker initialized successfully');
});