import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useLocation, useHistory, useParams } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import s from './ProductListScreen.module.css'
import Paginate from '../../components/Paginate'
import {
  listProducts,
  deleteProduct,
  createProduct,
} from '../../actions/productActions'
import { PRODUCT_CREATE_RESET } from '../../constants/productConstants'
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
  PlusIcon,
} from './icons'

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(function (w) { return w[0] }).join('').slice(0, 2).toUpperCase()
}

function formatPrice(value) {
  // Display $0 for falsy/zero, otherwise $X.XX with tabular nums alignment.
  if (value === 0 || value === null || value === undefined) return '$0'
  return '$' + Number(value).toFixed(2)
}

var ProductListScreen = function () {
  var location = useLocation()
  var history = useHistory()
  var dispatch = useDispatch()
  var routeParams = useParams()
  var pageNumber = routeParams.pageNumber || 1

  var userLogin = useSelector(function (state) { return state.userLogin })
  var userInfo = userLogin && userLogin.userInfo

  var productList = useSelector(function (state) { return state.productList })
  var loading = productList.loading
  var error = productList.error
  var products = productList.products || []
  var page = productList.page
  var pages = productList.pages

  var productDelete = useSelector(function (state) { return state.productDelete })
  var loadingDelete = productDelete.loading
  var errorDelete = productDelete.error
  var successDelete = productDelete.success

  var productCreate = useSelector(function (state) { return state.productCreate })
  var loadingCreate = productCreate.loading
  var errorCreate = productCreate.error
  var successCreate = productCreate.success
  var createdProduct = productCreate.product

  // Admin guard + create-reset + redirect-on-create + initial fetch + re-fetch on
  // successful delete / page change (existing proshop_mern pattern from
  // legacy ProductListScreen.js).
  useEffect(function () {
    dispatch({ type: PRODUCT_CREATE_RESET })

    if (!userInfo || !userInfo.isAdmin) {
      history.push('/login')
      return
    }

    if (successCreate) {
      history.push('/admin/product/' + createdProduct._id + '/edit')
    } else {
      dispatch(listProducts('', pageNumber))
    }
  }, [dispatch, history, userInfo, successDelete, successCreate, createdProduct, pageNumber])

  // ?state= and ?modal= overrides for dev/demo (take precedence over real fetch state)
  var params = new URLSearchParams(location.search)
  var forcedState = params.get('state')
  var forcedModal = params.get('modal') === '1'

  var searchState = useState('')
  var search = searchState[0]
  var setSearch = searchState[1]

  var sortState = useState({ field: 'name', dir: 'asc' })
  var sort = sortState[0]
  var setSort = sortState[1]

  var productToDeleteState = useState(null)
  var productToDelete = productToDeleteState[0]
  var setProductToDelete = productToDeleteState[1]

  var searchInputRef = useRef(null)

  // Open modal on first available product when ?modal=1 (demo screenshot helper)
  useEffect(function () {
    if (forcedModal && !productToDelete && products.length > 0) {
      setProductToDelete(products[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedModal, products.length])

  // Lock body scroll + Escape close while modal is open
  useEffect(function () {
    if (!productToDelete) return
    var prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') setProductToDelete(null)
    }
    window.addEventListener('keydown', onKey)
    return function () {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [productToDelete])

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

  var displayed = useMemo(function () {
    var list = products
    var q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(function (p) {
        return p.name.toLowerCase().indexOf(q) !== -1 ||
          (p.brand && p.brand.toLowerCase().indexOf(q) !== -1) ||
          (p.category && p.category.toLowerCase().indexOf(q) !== -1)
      })
    }
    var field = sort.field
    var dir = sort.dir
    return list.slice().sort(function (a, b) {
      var va, vb
      if (field === 'price') { va = a.price; vb = b.price }
      else if (field === 'category') { va = (a.category || '').toLowerCase(); vb = (b.category || '').toLowerCase() }
      else if (field === 'brand') { va = (a.brand || '').toLowerCase(); vb = (b.brand || '').toLowerCase() }
      else { va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase() }
      if (va < vb) return dir === 'asc' ? -1 : 1
      if (va > vb) return dir === 'asc' ? 1 : -1
      return 0
    })
  }, [products, search, sort])

  var chips = useMemo(function () {
    var c = []
    if (search.trim()) {
      c.push({ key: 'search', label: '"' + search + '"', clear: function () { setSearch('') } })
    }
    return c
  }, [search])

  var isFiltered = chips.length > 0

  function clearAll() { setSearch('') }

  function cycleSort(field) {
    setSort(function (prev) {
      if (prev.field === field) return { field: field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      return { field: field, dir: 'asc' }
    })
  }

  function navCls(path) {
    return location.pathname === path || location.pathname.indexOf(path + '/') === 0
      ? s.navItem + ' ' + s.navItemActive
      : s.navItem
  }

  function requestDelete(product) { setProductToDelete(product) }
  function cancelDelete() { setProductToDelete(null) }
  function confirmDelete() {
    var id = productToDelete._id
    setProductToDelete(null)
    dispatch(deleteProduct(id))
  }

  function createProductHandler() {
    dispatch(createProduct())
  }

  var userName = (userInfo && userInfo.name) || 'Admin'
  var userEmail = (userInfo && userInfo.email) || 'admin@proshop.dev'

  function renderLoading() {
    return (
      <div className={s.skeletonList} aria-busy="true" aria-label="Loading products">
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
          <div className={s.errorTitle}>Failed to load products</div>
          <div className={s.errorDesc}>
            {msg || 'Could not reach the products service. Check your connection.'}
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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <span style={{ opacity: 0.3 }}><PackageIcon size={32} /></span>
        </div>
        <div className={s.emptyTitle}>
          {isFilteredEmpty ? 'No products match your search' : 'No products yet'}
        </div>
        <div className={s.emptyDesc}>
          {isFilteredEmpty
            ? 'Try a different name, brand, or category.'
            : 'Click Create Product to add your first item.'}
        </div>
        {isFilteredEmpty && (
          <button className={s.emptyClear} onClick={clearAll}>Clear search</button>
        )}
      </div>
    )
  }

  function renderTable() {
    return (
      <table className={s.table} aria-label="Products">
        <colgroup>
          <col className={s.colId} />
          <col className={s.colName} />
          <col className={s.colPrice} />
          <col className={s.colCategory} />
          <col className={s.colBrand} />
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
              <button className={s.sortHeader} onClick={function () { cycleSort('price') }}>
                Price
                {sort.field === 'price' && (
                  <span className={s.sortArrow} data-dir={sort.dir}><ArrowUpIcon size={11} /></span>
                )}
              </button>
            </th>
            <th>
              <button className={s.sortHeader} onClick={function () { cycleSort('category') }}>
                Category
                {sort.field === 'category' && (
                  <span className={s.sortArrow} data-dir={sort.dir}><ArrowUpIcon size={11} /></span>
                )}
              </button>
            </th>
            <th>
              <button className={s.sortHeader} onClick={function () { cycleSort('brand') }}>
                Brand
                {sort.field === 'brand' && (
                  <span className={s.sortArrow} data-dir={sort.dir}><ArrowUpIcon size={11} /></span>
                )}
              </button>
            </th>
            <th className={s.actionsHeader}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map(function (p) {
            return (
              <tr key={p._id}>
                <td className={s.idCell} title={p._id}>{p._id}</td>
                <td className={s.nameCell}>{p.name}</td>
                <td className={s.priceCell}>{formatPrice(p.price)}</td>
                <td className={s.categoryCell}>{p.category}</td>
                <td className={s.brandCell}>{p.brand}</td>
                <td className={s.actionsCell}>
                  <Link
                    to={'/admin/product/' + p._id + '/edit'}
                    className={s.iconBtn}
                    aria-label={'Edit product ' + p.name}
                    title="Edit"
                  >
                    <PencilIcon size={14} />
                  </Link>
                  <button
                    type="button"
                    className={s.iconBtn + ' ' + s.iconBtnDanger}
                    aria-label={'Delete product ' + p.name}
                    title="Delete"
                    onClick={function () { requestDelete(p) }}
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
    if (loading || loadingCreate) return renderLoading()
    if (error) return renderError(error)
    if (products.length === 0) return renderEmpty('absolute')
    if (displayed.length === 0) return renderEmpty('filtered')
    return (
      <>
        {renderTable()}
        {pages > 1 && (
          <div className={s.paginationWrap}>
            <Paginate pages={pages} page={page} isAdmin={true} />
          </div>
        )}
      </>
    )
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
            <span className={s.breadcrumbCurrent}>Products</span>
          </nav>
        </header>

        <main className={s.main}>
          <div className={s.pageHeader}>
            <div className={s.pageHeaderTitleRow}>
              <h1 className={s.pageTitle}>Products</h1>
              <button
                type="button"
                className={s.btnPrimary}
                onClick={createProductHandler}
              >
                <PlusIcon size={14} /> Create Product
              </button>
            </div>
            <p className={s.pageSubtitle}>Manage your product catalog.</p>
          </div>

          {(errorDelete || errorCreate) && (
            <div className={s.errorAlert} role="alert" style={{ marginBottom: 16 }}>
              <span className={s.errorIcon}><AlertCircleIcon size={20} /></span>
              <div className={s.errorBody}>
                <div className={s.errorTitle}>
                  {errorDelete ? 'Failed to delete product' : 'Failed to create product'}
                </div>
                <div className={s.errorDesc}>{errorDelete || errorCreate}</div>
              </div>
            </div>
          )}

          <div className={s.toolbar}>
            <div className={s.toolbarMain}>
              <div className={s.toolbarActions}>
                <div className={s.searchWrap}>
                  <span className={s.searchIcon} aria-hidden="true">
                    <SearchIcon size={14} />
                  </span>
                  <input
                    ref={searchInputRef}
                    type="search"
                    className={s.input}
                    placeholder="Search by name, brand, or category…"
                    value={search}
                    onChange={function (e) { setSearch(e.target.value) }}
                    aria-label="Search products by name, brand, or category"
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

      {productToDelete && (
        <div
          className={s.modalOverlay}
          role="presentation"
          onClick={cancelDelete}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
            aria-describedby="delete-product-desc"
            className={s.modalPanel}
            onClick={function (e) { e.stopPropagation() }}
          >
            <header className={s.modalHeader}>
              <span className={s.modalIcon}><AlertTriangleIcon size={20} /></span>
              <h2 id="delete-product-title" className={s.modalTitle}>Delete product?</h2>
              <button
                type="button"
                className={s.modalClose}
                aria-label="Close"
                onClick={cancelDelete}
              >
                <XIcon size={14} />
              </button>
            </header>
            <div id="delete-product-desc" className={s.modalBody}>
              This will permanently remove <strong>{productToDelete.name}</strong>
              {' '}from the catalog. This cannot be undone.
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

export default ProductListScreen
