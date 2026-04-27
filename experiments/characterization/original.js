const addDecimals = (num) => Number((Math.round(num * 100) / 100).toFixed(2))

export const calculateOrderPrices = (orderItems) => {
  const itemsPrice = addDecimals(
    orderItems.reduce((acc, item) => acc + item.price * item.qty, 0)
  )
  const shippingPrice = addDecimals(itemsPrice > 100 ? 0 : 100)
  const taxPrice = addDecimals(0.15 * itemsPrice)
  const totalPrice = addDecimals(itemsPrice + shippingPrice + taxPrice)

  return { shippingPrice, taxPrice, totalPrice }
}
