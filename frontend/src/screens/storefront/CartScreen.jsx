import React, { useEffect } from 'react'
import { Link, useParams, useLocation, useHistory } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import s from './CartScreen.module.css'
import CartItem from './CartItem'
import { addToCart, removeFromCart } from '../../actions/cartActions'

function formatPrice(value) {
  if (value === null || value === undefined) return '$0.00'
  return '$' + Number(value).toFixed(2)
}

var CartScreen = function () {
  var params = useParams()
  var productId = params.id
  var location = useLocation()
  var history = useHistory()
  var dispatch = useDispatch()

  var qty = location.search ? Number(location.search.split('=')[1]) : 1

  var cart = useSelector(function (state) { return state.cart })
  var cartItems = (cart && cart.cartItems) || []

  useEffect(function () {
    if (productId) {
      dispatch(addToCart(productId, qty))
    }
  }, [dispatch, productId, qty])

  function handleQtyChange(id, nextQty) {
    dispatch(addToCart(id, nextQty))
  }

  function handleRemove(id) {
    dispatch(removeFromCart(id))
  }

  function checkoutHandler() {
    history.push('/login?redirect=shipping')
  }

  var totalItems = cartItems.reduce(function (acc, item) {
    return acc + Number(item.qty || 0)
  }, 0)

  var subtotal = cartItems.reduce(function (acc, item) {
    return acc + Number(item.qty || 0) * Number(item.price || 0)
  }, 0)

  var isEmpty = cartItems.length === 0

  if (isEmpty) {
    return (
      <main className={s.page}>
        <Link to='/' className={s.backLink}>Continue shopping</Link>

        <header className={s.sectionHeader}>
          <h1 className={s.title}>Shopping cart</h1>
        </header>

        <div className={s.empty}>
          <div className={s.emptyTitle}>Your cart is empty</div>
          <div className={s.emptyDesc}>Browse products and add what you need to get started.</div>
          <Link to='/' className={s.emptyAction}>Browse products</Link>
        </div>
      </main>
    )
  }

  return (
    <main className={s.page}>
      <Link to='/' className={s.backLink}>Continue shopping</Link>

      <div className={s.layout}>
        <section className={s.items} aria-label='Cart items'>
          <header className={s.sectionHeader}>
            <h1 className={s.title}>Shopping cart</h1>
            <p className={s.itemsCount} aria-live='polite'>
              {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </p>
          </header>

          <div className={s.itemList}>
            {cartItems.map(function (item) {
              return (
                <CartItem
                  key={item.product}
                  item={item}
                  onQtyChange={handleQtyChange}
                  onRemove={handleRemove}
                />
              )
            })}
          </div>
        </section>

        <aside className={s.summary} aria-label='Order summary'>
          <div className={s.summaryCard}>
            <h2 className={s.summaryTitle}>Order summary</h2>

            <dl className={s.summaryRow}>
              <dt className={s.summaryLabel}>
                Subtotal · {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </dt>
              <dd className={s.summaryValue}>{formatPrice(subtotal)}</dd>
            </dl>

            <div className={s.summaryDivider} aria-hidden='true' />

            <dl className={s.summaryRow + ' ' + s.summaryRowTotal}>
              <dt className={s.summaryLabel}>Total</dt>
              <dd className={s.summaryValue + ' ' + s.summaryValueTotal}>{formatPrice(subtotal)}</dd>
            </dl>

            <button
              type='button'
              className={s.checkoutBtn}
              onClick={checkoutHandler}
            >
              Proceed to Checkout
            </button>

            <p className={s.summaryFinePrint}>
              Shipping and taxes calculated at checkout.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}

export default CartScreen
