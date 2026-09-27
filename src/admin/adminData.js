import { useEffect, useState } from 'react';
import { categories, products, formatPeso } from '../mockData';

const ACCOUNTS_KEY = 'gearRentAccounts';
const PROVIDER_PRODUCTS_PREFIX = 'gearRentProviderProducts:';
const RENTED_ITEMS_PREFIX = 'gearRentRentedItems:';
const RENTAL_HISTORY_PREFIX = 'gearRentRentalHistory:';

function readJson(key, fallback) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function readAccounts() {
  const accounts = readJson(ACCOUNTS_KEY, []);
  return Array.isArray(accounts) ? accounts : [];
}

function readScopedArrays(prefix) {
  const records = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const value = readJson(key, []);
    if (!Array.isArray(value)) continue;
    records.push(...value.map((record) => ({
      ...record,
      accountEmail: key.slice(prefix.length),
    })));
  }
  return records;
}

function getAllProviderProducts() {
  return readScopedArrays(PROVIDER_PRODUCTS_PREFIX).map((product) => ({
    ...product,
    providerEmail: product.providerEmail || product.accountEmail,
  }));
}

function getAllRentals() {
  const active = readScopedArrays(RENTED_ITEMS_PREFIX).map((rental) => ({
    ...rental,
    status: rental.returnAt && rental.returnAt < Date.now() ? 'overdue' : 'active',
  }));
  const completed = readScopedArrays(RENTAL_HISTORY_PREFIX).map((rental) => ({
    ...rental,
    status: 'completed',
  }));
  return [...active, ...completed].sort((left, right) => (
    Number(right.rentedAt || right.finishedAt || 0) - Number(left.rentedAt || left.finishedAt || 0)
  ));
}

function getRentalAmount(rental) {
  return Number(rental.product?.price || 0) * Math.max(1, Number(rental.days) || 1);
}

function getProductName(rental) {
  return rental.product?.name || rental.product?.id || 'Unknown gear';
}

function getCategoryName(rental) {
  return rental.product?.category || 'Uncategorized';
}

function getAccountName(email, accounts) {
  return accounts.find((account) => account.email?.trim().toLowerCase() === email)?.name || email || 'Unknown account';
}

function formatPeriod(rental) {
  const start = rental.rentedAt || rental.paidAt;
  const end = rental.finishedAt || rental.returnAt;
  if (!start) return 'Date unavailable';
  const formatDate = (value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${formatDate(start)}${end ? ` - ${formatDate(end)}` : ''}`;
}

function getOrderId(rental, index) {
  return rental.id || `RENT-${String(index + 1).padStart(4, '0')}`;
}

function getWeekLabel(index) {
  return `W${index + 1}`;
}

function buildRevenueTrend(rentals) {
  const now = Date.now();
  const weekValues = Array.from({ length: 10 }, () => 0);
  rentals.forEach((rental) => {
    const timestamp = Number(rental.paidAt || rental.rentedAt || rental.finishedAt || 0);
    const weeksAgo = Math.floor((now - timestamp) / (7 * 86400000));
    if (weeksAgo >= 0 && weeksAgo < weekValues.length) weekValues[weekValues.length - 1 - weeksAgo] += getRentalAmount(rental);
  });
  return weekValues.map((value, index) => ({ label: getWeekLabel(index), value }));
}

function buildMonthlyVolume(rentals) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1));
  return months.map((month) => ({
    label: month.toLocaleDateString('en-US', { month: 'short' }),
    value: rentals.reduce((total, rental) => {
      const timestamp = new Date(rental.paidAt || rental.rentedAt || rental.finishedAt || 0);
      return timestamp.getFullYear() === month.getFullYear() && timestamp.getMonth() === month.getMonth()
        ? total + getRentalAmount(rental)
        : total;
    }, 0),
  }));
}

function buildUserDistribution(accounts) {
  const providerCount = accounts.filter((account) => account.tier === 'provider').length;
  const renterCount = Math.max(0, accounts.length - providerCount);
  const total = providerCount + renterCount;
  if (!total) return [{ label: 'Gear Renters', pct: 0 }, { label: 'Gear Providers', pct: 0 }];
  return [
    { label: 'Gear Renters', pct: Math.round((renterCount / total) * 100) },
    { label: 'Gear Providers', pct: Math.round((providerCount / total) * 100) },
  ];
}

export function readAdminData() {
  const accounts = readAccounts();
  const rentals = getAllRentals();
  const providerProducts = getAllProviderProducts();
  const totalRevenue = rentals.reduce((total, rental) => total + getRentalAmount(rental), 0);
  const activeRentals = rentals.filter((rental) => rental.status === 'active' || rental.status === 'overdue');
  const catalogProducts = [...products, ...providerProducts];
  const availableCatalogProducts = catalogProducts.filter((product) => product.status === 'available');
  const recentTransactions = rentals.slice(0, 6).map((rental, index) => ({
    id: getOrderId(rental, index),
    item: getProductName(rental),
    account: getAccountName(rental.accountEmail, accounts),
    status: rental.status === 'completed' ? 'returned' : rental.status === 'overdue' ? 'overdue' : 'on-set',
    amount: formatPeso(getRentalAmount(rental)),
  }));
  const accountRentalCounts = rentals.reduce((counts, rental) => {
    counts[rental.accountEmail] = (counts[rental.accountEmail] || 0) + 1;
    return counts;
  }, {});
  const topRenters = Object.entries(accountRentalCounts)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 5)
    .map(([email, items], index) => {
      const accountRentals = rentals.filter((rental) => rental.accountEmail === email);
      const categoryCounts = accountRentals.reduce((counts, rental) => {
        const category = getCategoryName(rental);
        counts[category] = (counts[category] || 0) + 1;
        return counts;
      }, {});
      const category = Object.entries(categoryCounts).sort(([, left], [, right]) => right - left)[0]?.[0] || 'No rentals';
      return {
        rank: index + 1,
        name: getAccountName(email, accounts),
        category,
        items,
        spend: formatPeso(accountRentals.reduce((total, rental) => total + getRentalAmount(rental), 0)),
      };
    });
  const catalogSize = catalogProducts.length;
  const utilization = catalogSize ? Math.round((activeRentals.length / catalogSize) * 100) : 0;
  const newUsers = accounts.filter((account) => Date.now() - Number(account.createdAt || 0) <= 30 * 86400000).length;
  const recentUsers = accounts
    .filter((account) => Date.now() - Number(account.createdAt || 0) <= 30 * 86400000)
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
    .map((account) => ({
      name: account.name || 'Unnamed account',
      email: account.email || 'No email provided',
      tier: account.tier || 'Gear Renter',
      joined: account.createdAt
        ? new Date(account.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Date unavailable',
    }));
  const availableGear = availableCatalogProducts.map((product) => ({
    name: product.name,
    category: categories.find((category) => category.id === product.category)?.name || 'General gear',
    price: formatPeso(Number(product.price) || 0),
  }));
  const utilizationByCategory = categories.map((category) => {
    const categoryProducts = catalogProducts.filter((product) => product.category === category.id);
    const categoryActive = activeRentals.filter((rental) => rental.product?.category === category.id).length;
    return {
      label: category.name,
      active: categoryActive,
      total: categoryProducts.length,
      pct: categoryProducts.length ? Math.round((categoryActive / categoryProducts.length) * 100) : 0,
    };
  }).filter((category) => category.total > 0);
  const accountDetails = accounts.reduce((details, account) => {
    const email = account.email?.trim().toLowerCase() || '';
    const accountRentals = rentals.filter((rental) => rental.accountEmail === email);
    const accountProducts = providerProducts.filter((product) => product.accountEmail === email);
    const now = new Date();
    const monthlySpend = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)).map((month) => ({
      label: month.toLocaleDateString('en-US', { month: 'short' }),
      value: accountRentals.reduce((total, rental) => {
        const timestamp = new Date(rental.paidAt || rental.rentedAt || rental.finishedAt || 0);
        return timestamp.getFullYear() === month.getFullYear() && timestamp.getMonth() === month.getMonth()
          ? total + getRentalAmount(rental)
          : total;
      }, 0),
    }));
    details[email] = {
      name: account.name || 'Unnamed renter',
      email: account.email || 'No email provided',
      tier: account.tier || 'Gear Renter',
      balance: Number(account.balance) || 0,
      joined: account.createdAt
        ? new Date(account.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Date unavailable',
      totalSpend: accountRentals.reduce((total, rental) => total + getRentalAmount(rental), 0),
      activeRentals: accountRentals.filter((rental) => rental.status === 'active' || rental.status === 'overdue').length,
      completedRentals: accountRentals.filter((rental) => rental.status === 'completed').length,
      depositsHeld: accountRentals.reduce((total, rental) => total + (rental.depositStatus === 'held' ? Number(rental.securityDeposit) || 0 : 0), 0),
      monthlySpend,
      uploadedGears: accountProducts.map((product) => ({
        name: product.name,
        status: product.status || 'available',
        price: formatPeso(Number(product.price) || 0),
      })),
      rentals: accountRentals.map((rental, index) => ({
        id: getOrderId(rental, index),
        item: getProductName(rental),
        status: rental.status,
        amount: getRentalAmount(rental),
        period: formatPeriod(rental),
      })),
    };
    return details;
  }, {});
  const renters = accounts
    .filter((account) => account.tier !== 'Gear Provider' && account.tier !== 'provider')
    .map((account) => {
      const email = account.email?.trim().toLowerCase() || '';
      const accountRentals = rentals.filter((rental) => rental.accountEmail === email);
      return {
        id: email || account.name,
        name: account.name || 'Unnamed renter',
        email: account.email || 'No email provided',
        tier: account.tier || 'Gear Renter',
        balance: formatPeso(Number(account.balance) || 0),
        rentalCount: accountRentals.length,
        joined: account.createdAt
          ? new Date(account.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Date unavailable',
        activeRentals: accountRentals.filter((rental) => rental.status === 'active' || rental.status === 'overdue').length,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    stats: {
      totalRevenue: { value: formatPeso(totalRevenue), change: `${rentals.length} recorded rental${rentals.length === 1 ? '' : 's'}`, trend: totalRevenue ? 'up' : 'flat' },
      activeRentals: { value: String(availableCatalogProducts.length), change: 'Available in catalog', trend: availableCatalogProducts.length ? 'up' : 'flat' },
      newUsers: { value: String(newUsers), change: `${accounts.length} total account${accounts.length === 1 ? '' : 's'}`, trend: newUsers ? 'up' : 'flat' },
      gearUtilization: { value: `${Math.min(100, utilization)}%`, change: `${catalogSize} catalog item${catalogSize === 1 ? '' : 's'}`, trend: utilization >= 80 ? 'warn' : 'flat' },
    },
    revenueTrend: buildRevenueTrend(rentals),
    recentTransactions,
    userRentalVolume: buildMonthlyVolume(rentals),
    userDistribution: buildUserDistribution(accounts),
    totalUsers: String(accounts.length),
    topRenters,
    accountDetails,
    renters,
    dashboardDetails: {
      revenueTransactions: rentals.slice(0, 12).map((rental, index) => ({
        id: getOrderId(rental, index),
        item: getProductName(rental),
        account: getAccountName(rental.accountEmail, accounts),
        amount: formatPeso(getRentalAmount(rental)),
        status: rental.status,
      })),
      availableGear,
      recentUsers,
      utilizationByCategory,
      catalogSize,
      activeGearCount: activeRentals.length,
    },
    rentalLog: rentals.map((rental, index) => ({
      id: getOrderId(rental, index),
      account: getAccountName(rental.accountEmail, accounts),
      accountType: accounts.find((account) => account.email?.trim().toLowerCase() === rental.accountEmail)?.tier === 'provider' ? 'Gear Provider' : 'Gear Renter',
      items: [getProductName(rental)],
      period: formatPeriod(rental),
      status: rental.status,
      revenue: formatPeso(getRentalAmount(rental)),
    })),
  };
}

export function useAdminData() {
  const [data, setData] = useState(readAdminData);

  useEffect(() => {
    const refresh = () => setData(readAdminData());
    window.addEventListener('storage', refresh);
    const timer = window.setInterval(refresh, 2000);
    return () => {
      window.removeEventListener('storage', refresh);
      window.clearInterval(timer);
    };
  }, []);

  return data;
}
