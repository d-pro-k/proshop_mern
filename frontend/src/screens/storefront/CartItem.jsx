import React from 'react'
import { Link } from 'react-router-dom'
import s from './CartItem.module.css'
import { Trash2Icon } from '../../components/icons'

function formatPrice(value) {
  if (value === null || value === undefined) return '$0.00'
  return '$' + Number(value).toFixed(2)
}

var CartItem = function (props) {
  var item = props.item
  if (!item) return null

  var countInStock = Number(item.countInStock) || 0
  var qty = Number(item.qty) || 1
  var lineTotal = qty * Number(item.price || 0)

  function handleQtyChange(e) {
    var nextQty = Number(e.target.value)
    if (props.onQtyChange) props.onQtyChange(item.product, nextQty)
  }

  function handleRemove() {
    if (props.onRemove) props.onRemove(item.product)
  }

  return (
    <article className={s.row}>
      <Link to={'/product/' + item.product} className={s.imageLink} aria-label={item.name}>
        <div className={s.imageWrap}>
          <img src={item.image} alt='' className={s.image} loading='lazy' />
        </div>
      </Link>

      <div className={s.body}>
        <Link to={'/product/' + item.product} className={s.name}>{item.name}</Link>
        <div className={s.priceUnit}>{formatPrice(item.price)} <span className={s.priceUnitLabel}>each</span></div>
      </div>

      <select
        id={'cart-qty-' + item.product}
        className={s.qtySelect}
        value={qty}
        onChange={handleQtyChange}
        aria-label={'Quantity for ' + item.name}
      >
        {Array.from({ length: countInStock }, function (_, i) {
          return (
            <option key={i + 1} value={i + 1}>{i + 1}</option>
          )
        })}
      </select>

      <div className={s.lineTotal}>{formatPrice(lineTotal)}</div>

      <button
        type='button'
        className={s.removeBtn}
        onClick={handleRemove}
        aria-label={'Remove ' + item.name + ' from cart'}
        title='Remove from cart'
      >
        <Trash2Icon size={16} />
      </button>
    </article>
  )
}

export default CartItem
