import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useLocation, useHistory } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import s from './UserListScreen.module.css'
import { listUsers, deleteUser } from '../../actions/userActions'
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
  PencilIcon,
  Trash2Icon,
  AlertTriangleIcon,
} from '../../components/icons'

var VIEW_TABS = ['All', 'Admins', 'Customers']

function getViewCount(users, view) {
  if (view === 'All') return users.length
  if (view === 'Admins') return users.filter(function (u) { return u.isAdmin }).length
  return users.filter(function (u) { return !u.isAdmin }).length
}

function filterByView(users, view) {
  if (view === 'All') return users
  if (view === 'Admins') return users.filter(function (u) { return u.isAdmin })
  return users.filter(function (u) { return !u.isAdmin })
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(function (w) { return w[0] }).join('').slice(0, 2).toUpperCase()
}

function RoleBadge(props) {
  var label = props.isAdmin ? 'Admin' : 'Customer'
  var cls = props.isAdmin ? s.roleBadge + ' ' + s.roleAdmin : s.roleBadge + ' ' + s.roleCustomer
  return (
    <span className={cls}>
      <span className={s.roleDot} aria-hidden="true" />
      {label}
    </span>
  )
}

var UserListScreen = function () {
  var location = useLocation()
  var history = useHistory()
  var dispatch = useDispatch()

  var userLogin = useSelector(function (state) { return state.userLogin })
  var userInfo = userLogin && userLogin.userInfo

  var userList = useSelector(function (state) { return state.userList })
  var loading = userList.loading
  var error = userList.error
  var users = userList.users || []

  var userDelete = useSelector(function (state) { return state.userDelete })
  var successDelete = userDelete.success

  // Admin guard + initial fetch + re-fetch after successful delete
  useEffect(function () {
    if (!userInfo || !userInfo.isAdmin) {
      history.push('/login')
      return
    }
    dispatch(listUsers())
  }, [dispatch, history, userInfo, successDelete])

  // ?state= and ?modal= overrides for dev/demo (take precedence over real fetch state)
  var params = new URLSearchParams(location.search)
  var forcedState = params.get('state')
  var forcedModal = params.get('modal') === '1'

  var activeViewState = useState('All')
  var activeView = activeViewState[0]
  var setActiveView = activeViewState[1]

  var searchState = useState('')
  var search = searchState[0]
  var setSearch = searchState[1]

  var sortState = useState({ field: 'name', dir: 'asc' })
  var sort = sortState[0]
  var setSort = sortState[1]

  var userToDeleteState = useState(null)
  var userToDelete = userToDeleteState[0]
  var setUserToDelete = userToDeleteState[1]

  var searchInputRef = useRef(null)

  // Open modal on first available user when ?modal=1 (demo screenshot helper)
  useEffect(function () {
    if (forcedModal && !userToDelete && users.length > 0) {
      setUserToDelete(users[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedModal, users.length])

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

  // Lock body scroll + Escape close while modal is open
  useEffect(function () {
    if (!userToDelete) return
    var prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') setUserToDelete(null)
    }
    window.addEventListener('keydown', onKey)
    return function () {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [userToDelete])

  var viewCounts = useMemo(function () {
    return VIEW_TABS.reduce(function (acc, v) {
      acc[v] = getViewCount(users, v)
      return acc
    }, {})
  }, [users])

  var displayed = useMemo(function () {
    var list = filterByView(users, activeView)
    var q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(function (u) {
        return u.name.toLowerCase().indexOf(q) !== -1 ||
          u.email.toLowerCase().indexOf(q) !== -1
      })
    }
    var field = sort.field
    var dir = sort.dir
    return list.slice().sort(function (a, b) {
      var va, vb
      if (field === 'email') { va = a.email.toLowerCase(); vb = b.email.toLowerCase() }
      else if (field === 'role') {
        va = a.isAdmin ? 0 : 1
        vb = b.isAdmin ? 0 : 1
      }
      else { va = a.name.toLowerCase(); vb = b.name.toLowerCase() }
      if (va < vb) return dir === 'asc' ? -1 : 1
      if (va > vb) return dir === 'asc' ? 1 : -1
      return 0
    })
  }, [users, activeView, search, sort])

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
      return { field: field, dir: 'asc' }
    })
  }

  function navCls(path) {
    return location.pathname === path ? s.navItem + ' ' + s.navItemActive : s.navItem
  }

  function requestDelete(user) {
    setUserToDelete(user)
  }
  function cancelDelete() {
    setUserToDelete(null)
  }
  function confirmDelete() {
    var id = userToDelete._id
    setUserToDelete(null)
    dispatch(deleteUser(id))
  }

  var userName = (userInfo && userInfo.name) || 'Admin'
  var userEmail = (userInfo && userInfo.email) || 'admin@proshop.dev'

  function renderLoading() {
    return (
      <div className={s.skeletonList} aria-busy="true" aria-label="Loading users">
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
          <div className={s.errorTitle}>Failed to load users</div>
          <div className={s.errorDesc}>
            {msg || 'Could not reach the users service. Check your connection.'}
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
          <span style={{ opacity: 0.3 }}><UsersIcon size={32} /></span>
        </div>
        <div className={s.emptyTitle}>
          {isFilteredEmpty ? 'No users match your filters' : 'No users yet'}
        </div>
        <div className={s.emptyDesc}>
          {isFilteredEmpty
            ? 'Try adjusting your search or view.'
            : 'Users will appear here when they register on the storefront.'}
        </div>
        {isFilteredEmpty && (
          <button className={s.emptyClear} onClick={clearAll}>Clear filters</button>
        )}
      </div>
    )
  }

  function renderTable() {
    return (
      <table className={s.table} aria-label="Users">
        <colgroup>
          <col className={s.colId} />
          <col className={s.colName} />
          <col className={s.colEmail} />
          <col className={s.colRole} />
          <col className={s.colActions} />
        </colgroup>
        <thead>
          <tr>
            <th>ID</th>
            <th>
              <button className={s.sortHeader} onClick={function () { cycleSort('name') }}>
                Name
                {sort.field === 'name' && (
                  <span className={s.sortArrow} data-dir={sort.dir}><ArrowUpIcon size={11} /></span>
                )}
              </button>
            </th>
            <th>
              <button className={s.sortHeader} onClick={function () { cycleSort('email') }}>
                Email
                {sort.field === 'email' && (
                  <span className={s.sortArrow} data-dir={sort.dir}><ArrowUpIcon size={11} /></span>
                )}
              </button>
            </th>
            <th>
              <button className={s.sortHeader} onClick={function () { cycleSort('role') }}>
                Role
                {sort.field === 'role' && (
                  <span className={s.sortArrow} data-dir={sort.dir}><ArrowUpIcon size={11} /></span>
                )}
              </button>
            </th>
            <th className={s.actionsHeader}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map(function (u) {
            var isSelf = userInfo && userInfo._id === u._id
            return (
              <tr key={u._id}>
                <td className={s.idCell} title={u._id}>{u._id}</td>
                <td className={s.nameCell}>{u.name}</td>
                <td className={s.emailCell}>
                  <a href={'mailto:' + u.email} className={s.emailLink}>{u.email}</a>
                </td>
                <td><RoleBadge isAdmin={u.isAdmin} /></td>
                <td className={s.actionsCell}>
                  <Link
                    to={'/admin/user/' + u._id + '/edit'}
                    className={s.iconBtn}
                    aria-label={'Edit user ' + u.name}
                    title="Edit"
                  >
                    <PencilIcon size={14} />
                  </Link>
                  <button
                    type="button"
                    className={
                      isSelf
                        ? s.iconBtn + ' ' + s.iconBtnDanger + ' ' + s.iconBtnDisabled
                        : s.iconBtn + ' ' + s.iconBtnDanger
                    }
                    aria-label={'Delete user ' + u.name}
                    aria-disabled={isSelf ? 'true' : undefined}
                    title={isSelf ? 'You cannot delete your own account' : 'Delete'}
                    onClick={function () {
                      if (isSelf) return
                      requestDelete(u)
                    }}
                  >
                    <Trash2Icon size={14} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  function renderContent() {
    // ?state= override wins (for demo screenshots)
    if (forcedState === 'loading') return renderLoading()
    if (forcedState === 'error') return renderError('Network request failed')
    if (forcedState === 'empty') return renderEmpty('absolute')
    if (forcedState === 'empty-filtered') return renderEmpty('filtered')
    // Real Redux state
    if (loading) return renderLoading()
    if (error) return renderError(error)
    if (users.length === 0) return renderEmpty('absolute')
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
          <Link to="/admin/productlist" className={location.pathname === '/admin/productlist' ? s.mobileNavItem + ' ' + s.mobileNavItemActive : s.mobileNavItem}>
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
            <span className={s.breadcrumbCurrent}>Users</span>
          </nav>
        </header>

        <main className={s.main}>
          <div className={s.pageHeader}>
            <h1 className={s.pageTitle}>Users</h1>
            <p className={s.pageSubtitle}>Manage admin and customer accounts.</p>
          </div>

          <div className={s.toolbar}>
            <div className={s.toolbarMain}>
              <div className={s.viewTabs} role="tablist" aria-label="Filter by view">
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
                aria-label="Filter by view"
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
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={function (e) { setSearch(e.target.value) }}
                    aria-label="Search users by name or email"
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

      {userToDelete && (
        <div
          className={s.modalOverlay}
          role="presentation"
          onClick={cancelDelete}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            aria-describedby="delete-user-desc"
            className={s.modalPanel}
            onClick={function (e) { e.stopPropagation() }}
          >
            <header className={s.modalHeader}>
              <span className={s.modalIcon}><AlertTriangleIcon size={20} /></span>
              <h2 id="delete-user-title" className={s.modalTitle}>Delete user?</h2>
              <button
                type="button"
                className={s.modalClose}
                aria-label="Close"
                onClick={cancelDelete}
              >
                <XIcon size={14} />
              </button>
            </header>
            <div id="delete-user-desc" className={s.modalBody}>
              This will permanently remove <strong>{userToDelete.name}</strong>
              {' '}({userToDelete.email}) from the system. This cannot be undone.
            </div>
            <footer className={s.modalActions}>
              <button
                type="button"
                className={s.btnSecondary}
                onClick={cancelDelete}
              >
                Cancel
              </button>
              <button
                type="button"
                className={s.btnDanger}
                onClick={confirmDelete}
                autoFocus
              >
                Delete
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserListScreen
