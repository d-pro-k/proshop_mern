import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useLocation, useHistory } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import s from './OrderListScreen.module.css'
import { listOrders } from '../../actions/orderActions'
import {
  LayoutDashboardIcon,
  UsersIcon,
  PackageIcon,
  ShoppingBagIcon,
  FlagIcon,
  SearchIcon,
  XIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  AlertCircleIcon,
  ArrowUpIcon,
  EyeIcon,
} from '../../components/icons'

var VIEW_TABS = ['All', 'Pending', 'Paid', 'Delivered']

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(function (w) { return w[0] }).join('').slice(0, 2).toUpperCase()
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    var d = new Date(iso)
    if (isNaN(d.getTime())) return iso.substring(0, 10)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch (e) {
    return iso.substring(0, 10)
  }
}

function formatMoney(value) {
  if (value === null || value === undefined) return '$0.00'
  return '$' + Number(value).toFixed(2)
}

function orderStatus(o) {
  if (o.isDelivered) return 'Delivered'
  if (o.isPaid) return 'Paid'
  return 'Pending'
}

function getViewCount(orders, view) {
  if (view === 'All') return orders.length
  return orders.filter(function (o) { return orderStatus(o) === view }).length
}

function filterByView(orders, view) {
  if (view === 'All') return orders
  return orders.filter(function (o) { return orderStatus(o) === view })
}

var OrderListScreen = function () {
  var location = useLocation()
  var history = useHistory()
  var dispatch = useDispatch()

  var userLogin = useSelector(function (state) { return state.userLogin })
  var userInfo = userLogin && userLogin.userInfo

  var orderList = useSelector(function (state) { return state.orderList })
  var loading = orderList.loading
  var error = orderList.error
  var orders = orderList.orders || []

  useEffect(function () {
    if (!userInfo || !userInfo.isAdmin) {
      history.push('/login')
      return
    }
    dispatch(listOrders())
  }, [dispatch, history, userInfo])

  // ?state= overrides for dev/demo (no ?modal= here — orders have no destructive action)
  var params = new URLSearchParams(location.search)
  var forcedState = params.get('state')

  var activeViewState = useState('All')
  var activeView = activeViewState[0]
  var setActiveView = activeViewState[1]

  var searchState = useState('')
  var search = searchState[0]
  var setSearch = searchState[1]

  // Default sort: date desc (newest first) — admin scenario "what's new"
  var sortState = useState({ field: 'date', dir: 'desc' })
  var sort = sortState[0]
  var setSort = sortState[1]

  var searchInputRef = useRef(null)

  // ⌘K / Ctrl+K → focus search input
  useEffect(function () {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (searchInputRef.current) searchInputRef.current.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return function () { window.removeEventListener('keydown', onKey) }
  }, [])

  var viewCounts = useMemo(function () {
    return VIEW_TABS.reduce(function (acc, v) {
      acc[v] = getViewCount(orders, v)
      return acc
    }, {})
  }, [orders])

  var displayed = useMemo(function () {
    var list = filterByView(orders, activeView)
    var q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(function (o) {
        var name = (o.user && o.user.name) ? o.user.name.toLowerCase() : ''
        return name.indexOf(q) !== -1
      })
    }
    var field = sort.field
    var dir = sort.dir
    return list.slice().sort(function (a, b) {
      var va, vb
      if (field === 'total') { va = a.totalPrice || 0; vb = b.totalPrice || 0 }
      else if (field === 'user') {
        va = (a.user && a.user.name) ? a.user.name.toLowerCase() : ''
        vb = (b.user && b.user.name) ? b.user.name.toLowerCase() : ''
      }
      else { va = a.createdAt || ''; vb = b.createdAt || '' }
      if (va < vb) return dir === 'asc' ? -1 : 1
      if (va > vb) return dir === 'asc' ? 1 : -1
      return 0
    })
  }, [orders, activeView, search, sort])

  var chips = useMemo(function () {
    var c = []
    if (activeView !== 'All') {
      c.push({ key: 'view', label: 'View: ' + activeView, clear: function () { setActiveView('All') } })
    }
    if (search.trim()) {
      c.push({ key: 'search', label: '"' + search + '"', clear: function () { setSearch('') } })
    }
    return c
  }, [activeView, search])

  var isFiltered = chips.length > 0

  function clearAll() { setActiveView('All'); setSearch('') }

  function cycleSort(field) {
    setSort(function (prev) {
      if (prev.field === field) return { field: field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      // First click on a new column: default desc for date/total (newest/biggest first), asc for text
      var defaultDir = (field === 'date' || field === 'total') ? 'desc' : 'asc'
      return { field: field, dir: defaultDir }
    })
  }

  function navCls(path) {
    return location.pathname === path ? s.navItem + ' ' + s.navItemActive : s.navItem
  }

  var userName = (userInfo && userInfo.name) || 'Admin'
  var userEmail = (userInfo && userInfo.email) || 'admin@proshop.dev'

  function renderLoading() {
    return (
      <div className={s.skeletonList} aria-busy="true" aria-label="Loading orders">
        {[0, 1, 2, 3, 4, 5, 6, 7].map(function (i) {
          return <div key={i} className={s.skeletonRow} style={{ opacity: 1 - i * 0.08 }} />
        })}
      </div>
    )
  }

  function renderError(msg) {
    return (
      <div className={s.errorAlert} role="alert">
        <span className={s.errorIcon}><AlertCircleIcon size={20} /></span>
        <div className={s.errorBody}>
          <div className={s.errorTitle}>Failed to load orders</div>
          <div className={s.errorDesc}>
            {msg || 'Could not reach the orders service. Check your connection.'}
          </div>
          <button className={s.errorRetry} onClick={function () { window.location.reload() }}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  function renderEmpty(kind) {
    var isFilteredEmpty = kind === 'filtered' || isFiltered
    return (
      <div className={s.empty}>
        <div className={s.emptyIconWrap}>
          <span style={{ opacity: 0.3 }}><ShoppingBagIcon size={32} /></span>
        </div>
        <div className={s.emptyTitle}>
          {isFilteredEmpty ? 'No orders match your filters' : 'No orders yet'}
        </div>
        <div className={s.emptyDesc}>
          {isFilteredEmpty
            ? 'Try a different view or search.'
            : 'Orders will appear here as customers check out.'}
        </div>
        {isFilteredEmpty && (
          <button className={s.emptyClear} onClick={clearAll}>Clear filters</button>
        )}
      </div>
    )
  }

  function renderStatusCell(timestamp, kind) {
    if (timestamp) {
      var label = kind + ' on ' + formatDate(timestamp)
      return (
        <span
          className={s.statusDot + ' ' + s.statusDotOk}
          title={label}
          aria-label={label}
          role="img"
        />
      )
    }
    var pendingLabel = 'Not yet ' + kind.toLowerCase()
    return (
      <span
        className={s.statusDot + ' ' + s.statusDotPending}
        title={pendingLabel}
        aria-label={pendingLabel}
        role="img"
      />
    )
  }

  function renderTable() {
    return (
      <table className={s.table} aria-label="Orders">
        <colgroup>
          <col className={s.colId} />
          <col className={s.colUser} />
          <col className={s.colDate} />
          <col className={s.colTotal} />
          <col className={s.colPaid} />
          <col className={s.colDelivered} />
          <col className={s.colActions} />
        </colgroup>
        <thead>
          <tr>
            <th>ID</th>
            <th>
              <button className={s.sortHeader} onClick={function () { cycleSort('user') }}>
                User
                {sort.field === 'user' && (
                  <span className={s.sortArrow} data-dir={sort.dir}><ArrowUpIcon size={11} /></span>
                )}
              </button>
            </th>
            <th>
              <button className={s.sortHeader} onClick={function () { cycleSort('date') }}>
                Date
                {sort.field === 'date' && (
                  <span className={s.sortArrow} data-dir={sort.dir}><ArrowUpIcon size={11} /></span>
                )}
              </button>
            </th>
            <th>
              <button className={s.sortHeader} onClick={function () { cycleSort('total') }}>
                Total
                {sort.field === 'total' && (
                  <span className={s.sortArrow} data-dir={sort.dir}><ArrowUpIcon size={11} /></span>
                )}
              </button>
            </th>
            <th>Paid</th>
            <th>Delivered</th>
            <th className={s.actionsHeader}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map(function (o) {
            var userLabel = (o.user && o.user.name) ? o.user.name : '(deleted user)'
            var userCls = (o.user && o.user.name) ? s.userCell : s.userCell + ' ' + s.userCellDeleted
            return (
              <tr key={o._id}>
                <td className={s.idCell} title={o._id}>{o._id}</td>
                <td className={userCls}>{userLabel}</td>
                <td className={s.dateCell}>{formatDate(o.createdAt)}</td>
                <td className={s.totalCell}>{formatMoney(o.totalPrice)}</td>
                <td className={s.statusCell}>{renderStatusCell(o.isPaid ? o.paidAt : null, 'Paid')}</td>
                <td className={s.statusCell}>{renderStatusCell(o.isDelivered ? o.deliveredAt : null, 'Delivered')}</td>
                <td className={s.actionsCell}>
                  <Link
                    to={'/order/' + o._id}
                    className={s.iconBtn}
                    aria-label={'View order ' + o._id}
                    title="Details"
                  >
                    <EyeIcon size={14} />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  function renderContent() {
    // ?state= override wins
    if (forcedState === 'loading') return renderLoading()
    if (forcedState === 'error') return renderError('Network request failed')
    if (forcedState === 'empty') return renderEmpty('absolute')
    if (forcedState === 'empty-filtered') return renderEmpty('filtered')
    // Real Redux state
    if (loading) return renderLoading()
    if (error) return renderError(error)
    if (orders.length === 0) return renderEmpty('absolute')
    if (displayed.length === 0) return renderEmpty('filtered')
    return renderTable()
  }

  return (
    <div className={s.dashboard}>
      <nav className={s.sidebar} aria-label="Admin navigation">
        <div className={s.brand}>
          <LayoutDashboardIcon size={18} />
          Admin
        </div>

        <span className={s.sectionLabel}>Manage</span>
        <div className={s.navGroup}>
          <Link to="/admin/userlist" className={navCls('/admin/userlist')}>
            <UsersIcon size={16} /> Users
          </Link>
          <Link to="/admin/productlist" className={navCls('/admin/productlist')}>
            <PackageIcon size={16} /> Products
          </Link>
          <Link to="/admin/orderlist" className={navCls('/admin/orderlist')}>
            <ShoppingBagIcon size={16} /> Orders
          </Link>
        </div>

        <span className={s.sectionLabel}>Platform</span>
        <div className={s.navGroup}>
          <Link to="/admin/feature-flags" className={navCls('/admin/feature-flags')}>
            <FlagIcon size={16} /> Feature flags
          </Link>
        </div>

        <div className={s.spacer} />

        <a href="/" className={s.footerLink}>
          <ExternalLinkIcon size={14} /> View storefront
        </a>

        <div className={s.userDivider} />

        <div className={s.userWidget}>
          <span className={s.avatar} aria-hidden="true">{initials(userName)}</span>
          <div className={s.userMeta}>
            <div className={s.userName}>{userName}</div>
            <div className={s.userEmail}>{userEmail}</div>
          </div>
          <button className={s.userMenu} aria-label="User menu">
            <MoreHorizontalIcon size={16} />
          </button>
        </div>
      </nav>

      <div className={s.mainColumn}>
        <nav className={s.mobileNav} aria-label="Admin navigation">
          <Link to="/admin/userlist" className={location.pathname === '/admin/userlist' ? s.mobileNavItem + ' ' + s.mobileNavItemActive : s.mobileNavItem}>
            <UsersIcon size={14} /> Users
          </Link>
          <Link to="/admin/productlist" className={location.pathname.indexOf('/admin/productlist') === 0 ? s.mobileNavItem + ' ' + s.mobileNavItemActive : s.mobileNavItem}>
            <PackageIcon size={14} /> Products
          </Link>
          <Link to="/admin/orderlist" className={location.pathname === '/admin/orderlist' ? s.mobileNavItem + ' ' + s.mobileNavItemActive : s.mobileNavItem}>
            <ShoppingBagIcon size={14} /> Orders
          </Link>
          <Link to="/admin/feature-flags" className={location.pathname === '/admin/feature-flags' ? s.mobileNavItem + ' ' + s.mobileNavItemActive : s.mobileNavItem}>
            <FlagIcon size={14} /> Flags
          </Link>
        </nav>

        <header className={s.topbar}>
          <nav className={s.breadcrumb} aria-label="Breadcrumb">
            <span>Admin</span>
            <span className={s.breadcrumbSep} aria-hidden="true">&rsaquo;</span>
            <span className={s.breadcrumbCurrent}>Orders</span>
          </nav>
        </header>

        <main className={s.main}>
          <div className={s.pageHeader}>
            <h1 className={s.pageTitle}>Orders</h1>
            <p className={s.pageSubtitle}>Track payment and delivery status.</p>
          </div>

          <div className={s.toolbar}>
            <div className={s.toolbarMain}>
              <div className={s.viewTabs} role="tablist" aria-label="Filter by status">
                {VIEW_TABS.map(function (view) {
                  var isActive = activeView === view
                  return (
                    <button
                      key={view}
                      role="tab"
                      aria-selected={isActive}
                      className={isActive ? s.viewTab + ' ' + s.viewTabActive : s.viewTab}
                      onClick={function () { setActiveView(view) }}
                    >
                      {view}
                      <span className={s.viewTabCount}>{viewCounts[view] || 0}</span>
                    </button>
                  )
                })}
              </div>

              <select
                className={s.viewTabsSelect}
                value={activeView}
                onChange={function (e) { setActiveView(e.target.value) }}
                aria-label="Filter by status"
              >
                {VIEW_TABS.map(function (view) {
                  return (
                    <option key={view} value={view}>
                      {view} ({viewCounts[view] || 0})
                    </option>
                  )
                })}
              </select>

              <div className={s.toolbarActions}>
                <div className={s.searchWrap}>
                  <span className={s.searchIcon} aria-hidden="true">
                    <SearchIcon size={14} />
                  </span>
                  <input
                    ref={searchInputRef}
                    type="search"
                    className={s.input}
                    placeholder="Search by user name…"
                    value={search}
                    onChange={function (e) { setSearch(e.target.value) }}
                    aria-label="Search orders by user name"
                  />
                  {!search && <span className={s.kbdHint}>⌘K</span>}
                  {search && (
                    <button
                      className={s.searchClear}
                      onClick={function () { setSearch('') }}
                      aria-label="Clear search"
                    >
                      <XIcon size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {isFiltered && (
              <div className={s.chipsRow}>
                {chips.map(function (chip) {
                  return (
                    <span key={chip.key} className={s.chip}>
                      {chip.label}
                      <button
                        className={s.chipRemove}
                        onClick={chip.clear}
                        aria-label={'Remove ' + chip.label + ' filter'}
                      >
                        <XIcon size={10} />
                      </button>
                    </span>
                  )
                })}
                <button className={s.clearAll} onClick={clearAll}>Clear all</button>
              </div>
            )}

            {isFiltered && (
              <div className={s.resultCount} aria-live="polite">
                {displayed.length} result{displayed.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default OrderListScreen
