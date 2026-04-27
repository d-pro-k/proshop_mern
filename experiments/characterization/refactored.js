const addDecimals = (num) => {
  const roundedToTwoDigits = Math.round(num * 100) / 100

  return Number(roundedToTwoDigits.toFixed(2))
}

const sumItemsPrice = (orderItems) => {
  let subtotal = 0

  for (const item of orderItems) {
    subtotal += item.price * item.qty
  }

  return addDecimals(subtotal)
}

export const calculateOrderPrices = (orderItems) => {
  const itemsPrice = sumItemsPrice(orderItems)
  const shippingPrice = addDecimals(itemsPrice > 100 ? 0 : 100)
  const taxPrice = addDecimals(itemsPrice * 0.15)
  const totalPrice = addDecimals(itemsPrice + shippingPrice + taxPrice)

  return { shippingPrice, taxPrice, totalPrice }
}
