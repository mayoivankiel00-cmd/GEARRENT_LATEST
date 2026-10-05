import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getTierLevel } from '../lib/providerAccess';
import { formatPeso, membershipTiers, TIER_GUEST } from '../lib/pricing';
import { useCategories } from '../context/CategoryContext';

// All admin pages read one snapshot from admin_dashboard_snapshot() (see
// gearrent_integrity_update.sql). The function refuses non-admins, so this
// data never reaches other accounts.
const REFRESH_INTERVAL_MS = 30 * 1000;

function toTime(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function normalizeAccount(row) {
  return {
    id: row.id,
    email: normalizeEmail(row.email),
    name: row.name || '',
    tier: row.tier || TIER_GUEST,
    role: row.role || 'customer',
    balance: Number(row.balance) || 0,
    createdAt: toTime(row.created_at),
  };
}

// Database statuses are active / returned / finished; the admin pages use
// active / overdue / completed.
function normalizeRental(row) {
  const returnAt = toTime(row.return_at);
  const status = row.status === 'active'
    ? (returnAt && returnAt < Date.now() ? 'overdue' : 'active')
    : 'completed';
  return {
    id: String(row.id),
    accountEmail: normalizeEmail(row.email),
    product: { id: row.product_id, name: row.product_name, category: row.category_id },
    days: Number(row.days) || 0,
    status,
    rentedAt: toTime(row.rented_at),
    paidAt: toTime(row.paid_at),
    returnAt,
    finishedAt: toTime(row.finished_at),
    amount: Number(row.rental_amount) || 0,
    securityDeposit: Number(row.security_deposit) || 0,
    depositStatus: row.deposit_status,
  };
}

function normalizeProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price) || 0,
    status: row.status,
    category: row.category_id,
    approvalStatus: row.approval_status || 'approved',
    providerEmail: normalizeEmail(row.provider_email),
  };
}

function getRentalAmount(rental) {
  return rental.amount;
}

function getProductName(rental) {
  return rental.product?.name || rental.product?.id || 'Unknown gear';
}

function getCategoryName(rental, categories) {
  return categories.find((category) => category.id === rental.product?.category)?.name || 'Uncategorized';
}

function getAccountName(email, accounts) {
  return accounts.find((account) => account.email === email)?.name || email || 'Unknown account';
}

function formatPeriod(rental) {
  const start = rental.rentedAt || rental.paidAt;
  const end = rental.finishedAt || rental.returnAt;
  if (!start) return 'Date unavailable';
  const formatDate = (value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${formatDate(start)}${end ? ` - ${formatDate(end)}` : ''}`;
}

function formatJoined(createdAt) {
  return createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Date unavailable';
}

function getWeekLabel(index) {
  return `W${index + 1}`;
}

function buildRevenueTrend(rentals) {
  const now = Date.now();
  const weekValues = Array.from({ length: 10 }, () => 0);
  rentals.forEach((rental) => {
    const timestamp = rental.paidAt || rental.rentedAt || rental.finishedAt;
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
  const total = accounts.length;
  return membershipTiers.map((tier) => {
    const count = accounts.filter((account) => getTierLevel(account) === tier.level).length;
    return { label: `${tier.name}s`, pct: total ? Math.round((count / total) * 100) : 0 };
  });
}

export function buildAdminData(snapshot, categories = []) {
  const accounts = (snapshot?.accounts || []).map(normalizeAccount);
  const rentals = (snapshot?.rentals || []).map(normalizeRental);
  const allProducts = (snapshot?.products || []).map(normalizeProduct);
  // Pending / rejected listings aren't part of the public catalog.
  const catalogProducts = allProducts.filter((product) => product.approvalStatus === 'approved');

  const totalRevenue = rentals.reduce((total, rental) => total + getRentalAmount(rental), 0);
  const activeRentals = rentals.filter((rental) => rental.status === 'active' || rental.status === 'overdue');
  const availableCatalogProducts = catalogProducts.filter((product) => product.status === 'available');
  const recentTransactions = rentals.slice(0, 6).map((rental) => ({
    id: rental.id,
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
        const category = getCategoryName(rental, categories);
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
  const isRecent = (account) => Date.now() - account.createdAt <= 30 * 86400000;
  const newUsers = accounts.filter(isRecent).length;
  const recentUsers = accounts
    .filter(isRecent)
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((account) => ({
      name: account.name || 'Unnamed account',
      email: account.email || 'No email provided',
      tier: account.tier,
      joined: formatJoined(account.createdAt),
    }));
  const availableGear = availableCatalogProducts.map((product) => ({
    name: product.name,
    category: categories.find((category) => category.id === product.category)?.name || 'General gear',
    price: formatPeso(product.price),
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
    const { email } = account;
    const accountRentals = rentals.filter((rental) => rental.accountEmail === email);
    const accountProducts = allProducts.filter((product) => product.providerEmail === email);
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
      id: account.id,
      role: account.role,
      name: account.name || 'Unnamed renter',
      email: account.email || 'No email provided',
      tier: account.tier,
      balance: account.balance,
      joined: formatJoined(account.createdAt),
      totalSpend: accountRentals.reduce((total, rental) => total + getRentalAmount(rental), 0),
      activeRentals: accountRentals.filter((rental) => rental.status === 'active' || rental.status === 'overdue').length,
      completedRentals: accountRentals.filter((rental) => rental.status === 'completed').length,
      depositsHeld: accountRentals.reduce((total, rental) => total + (rental.depositStatus === 'held' ? rental.securityDeposit : 0), 0),
      monthlySpend,
      uploadedGears: accountProducts.map((product) => ({
        name: product.name,
        status: product.approvalStatus === 'approved' ? product.status || 'available' : product.approvalStatus,
        price: formatPeso(product.price),
      })),
      rentals: accountRentals.map((rental) => ({
        id: rental.id,
        item: getProductName(rental),
        status: rental.status,
        amount: getRentalAmount(rental),
        period: formatPeriod(rental),
      })),
    };
    return details;
  }, {});
  // Every member account (Guest, Renter and Provider); admins are listed on
  // Admin Accounts instead.
  const renters = accounts
    .filter((account) => account.role !== 'admin')
    .map((account) => {
      const accountRentals = rentals.filter((rental) => rental.accountEmail === account.email);
      return {
        id: account.email || account.id,
        name: account.name || 'Unnamed renter',
        email: account.email || 'No email provided',
        tier: account.tier,
        balance: formatPeso(account.balance),
        rentalCount: accountRentals.length,
        joined: formatJoined(account.createdAt),
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
    membershipRevenue: Number(snapshot?.membership_revenue) || 0,
    revenueTrend: buildRevenueTrend(rentals),
    recentTransactions,
    userRentalVolume: buildMonthlyVolume(rentals),
    userDistribution: buildUserDistribution(accounts),
    totalUsers: String(accounts.length),
    topRenters,
    accountDetails,
    renters,
    dashboardDetails: {
      revenueTransactions: rentals.slice(0, 12).map((rental) => ({
        id: rental.id,
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
    rentalLog: rentals.map((rental) => ({
      id: rental.id,
      account: getAccountName(rental.accountEmail, accounts),
      accountType: membershipTiers[getTierLevel(accounts.find((account) => account.email === rental.accountEmail))].name,
      items: [getProductName(rental)],
      period: formatPeriod(rental),
      status: rental.status,
      revenue: formatPeso(getRentalAmount(rental)),
    })),
  };
}

export function useAdminData() {
  const { categories } = useCategories();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const data = useMemo(() => buildAdminData(snapshot, categories), [snapshot, categories]);

  const refresh = useCallback(async () => {
    const { data: nextSnapshot, error: rpcError } = await supabase.rpc('admin_dashboard_snapshot');
    if (rpcError) {
      console.error('admin_dashboard_snapshot failed', rpcError);
      setError(rpcError.message || 'Could not load dashboard data.');
    } else {
      setSnapshot(nextSnapshot);
      setError('');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return { ...data, loading, error, refresh };
}
