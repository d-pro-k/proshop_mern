import mongoose from 'mongoose'
import asyncHandler from 'express-async-handler'
import Order from '../models/orderModel.js'
import Product from '../models/productModel.js'

const addDecimals = (num) => Number((Math.round(num * 100) / 100).toFixed(2))

const calculateOrderPrices = (orderItems) => {
  const itemsPrice = addDecimals(
    orderItems.reduce((acc, item) => acc + item.price * item.qty, 0)
  )
  const shippingPrice = addDecimals(itemsPrice > 100 ? 0 : 100)
  const taxPrice = addDecimals(0.15 * itemsPrice)
  const totalPrice = addDecimals(itemsPrice + shippingPrice + taxPrice)

  return { shippingPrice, taxPrice, totalPrice }
}

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = asyncHandler(async (req, res) => {
  const { orderItems, shippingAddress, paymentMethod } = req.body

  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    res.status(400)
    throw new Error('No order items')
  }

  const uniqueProductIds = [
    ...new Set(orderItems.map((item) => item.product && item.product.toString())),
  ]

  if (
    uniqueProductIds.some(
      (productId) => !mongoose.Types.ObjectId.isValid(productId)
    )
  ) {
    res.status(400)
    throw new Error('Invalid order items')
  }

  const products = await Product.find({
    _id: { $in: uniqueProductIds },
  }).select('_id name image price')
  const productMap = new Map(
    products.map((product) => [product._id.toString(), product])
  )

  if (products.length !== uniqueProductIds.length) {
    res.status(400)
    throw new Error('Invalid order items')
  }

  const normalizedOrderItems = []

  for (const item of orderItems) {
    const product = productMap.get(item.product.toString())
    const qty = Number(item.qty)

    if (!product || !Number.isInteger(qty) || qty <= 0) {
      res.status(400)
      throw new Error('Invalid order items')
    }

    normalizedOrderItems.push({
      name: product.name,
      qty,
      image: product.image,
      price: product.price,
      product: product._id,
    })
  }

  const { shippingPrice, taxPrice, totalPrice } =
    calculateOrderPrices(normalizedOrderItems)

  const order = new Order({
    orderItems: normalizedOrderItems,
    user: req.user._id,
    shippingAddress,
    paymentMethod,
    taxPrice,
    shippingPrice,
    totalPrice,
  })

  const createdOrder = await order.save()

  res.status(201).json(createdOrder)
})

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    'user',
    'name email'
  )

  if (order) {
    res.json(order)
  } else {
    res.status(404)
    throw new Error('Order not found')
  }
})

// @desc    Update order to paid
// @route   GET /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)

  if (order) {
    order.isPaid = true
    order.paidAt = Date.now()
    order.paymentResult = {
      id: req.body.id,
      status: req.body.status,
      update_time: req.body.update_time,
      email_address: req.body.payer.email_address,
    }

    const updatedOrder = await order.save()

    res.json(updatedOrder)
  } else {
    res.status(404)
    throw new Error('Order not found')
  }
})

// @desc    Update order to delivered
// @route   GET /api/orders/:id/deliver
// @access  Private/Admin
const updateOrderToDelivered = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)

  if (order) {
    order.isDelivered = true
    order.deliveredAt = Date.now()

    const updatedOrder = await order.save()

    res.json(updatedOrder)
  } else {
    res.status(404)
    throw new Error('Order not found')
  }
})

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
  res.json(orders)
})

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({}).populate('user', 'id name')
  res.json(orders)
})

export {
  addOrderItems,
  getOrderById,
  updateOrderToPaid,
  updateOrderToDelivered,
  getMyOrders,
  getOrders,
}
